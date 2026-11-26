import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const datasetPath = path.resolve(__dirname, '../data/foodProducts.json');

export async function loadProducts() {
  const text = await fs.readFile(datasetPath, 'utf8');
  const products = JSON.parse(text);
  if (!Array.isArray(products)) throw new Error('The demo food dataset must contain an array.');
  return products;
}

export function normalizeCategory(category = '') {
  const value = String(category).trim().toLowerCase().replace(/[_-]+/g, ' ');
  const rules = [
    [/biscuit|digestive|cracker/, 'Biscuits'],
    [/cookie/, 'Cookies'],
    [/breakfast|cereal|granola|muesli/, 'Breakfast Cereals'],
    [/chip|crisp/, 'Chips'],
    [/noodle|ramen/, 'Instant Noodles'],
    [/bread|loaf/, 'Bread'],
    [/soft drink|cola|soda|sparkling/, 'Soft Drinks'],
    [/fruit drink|juice|nectar/, 'Fruit Drinks'],
    [/packaged snack|snack|puff|popcorn|trail mix/, 'Packaged Snacks'],
    [/chocolate|cocoa/, 'Chocolate']
  ];
  for (const [pattern, normalized] of rules) if (pattern.test(value)) return normalized;
  return String(category).trim();
}

export async function getProductsByCategory(category) {
  const normalized = normalizeCategory(category);
  const products = await loadProducts();
  return products.filter(product => normalizeCategory(product.category) === normalized);
}

function valueFrom(product, key) {
  const nutrition = product?.nutrition || product || {};
  if (nutrition[key] != null && nutrition[key] !== '') return Number(nutrition[key]);
  return null;
}

function availableNumber(value) {
  return value != null && Number.isFinite(value) ? value : null;
}

export function calculateComparisonScore(product) {
  const nutrition = product?.nutrition || product || {};
  const provided = availableNumber(Number(product?.score)) ?? availableNumber(Number(nutrition.score));
  if (provided != null) return Math.max(0, Math.min(100, Math.round(provided)));
  let points = 0;
  let weight = 0;
  const add = (value, weightValue) => { if (value != null) { points += value * weightValue; weight += weightValue; } };
  const calories = availableNumber(Number(nutrition.calories));
  const sugar = availableNumber(Number(nutrition.sugar));
  const saturatedFat = availableNumber(Number(nutrition.saturatedFat));
  const sodium = availableNumber(Number(nutrition.sodium));
  const protein = availableNumber(Number(nutrition.protein));
  if (calories != null) add(calories <= 350 ? 100 : calories <= 450 ? 75 : calories <= 550 ? 45 : 20, 15);
  if (sugar != null) add(sugar <= 5 ? 100 : sugar <= 12 ? 75 : sugar <= 20 ? 45 : 20, 20);
  if (saturatedFat != null) add(saturatedFat <= 2 ? 100 : saturatedFat <= 5 ? 70 : saturatedFat <= 10 ? 40 : 15, 15);
  if (sodium != null) add(sodium <= 120 ? 100 : sodium <= 400 ? 72 : sodium <= 700 ? 40 : 15, 15);
  if (protein != null) add(protein >= 12 ? 100 : protein >= 8 ? 78 : protein >= 4 ? 50 : 25, 15);
  return weight ? Math.round(points / weight) : 50;
}

export async function findAlternatives(productA, productB, requestedCategory) {
  const categoryA = normalizeCategory(productA.category);
  const categoryB = normalizeCategory(productB.category);
  const category = normalizeCategory(requestedCategory) || categoryA || categoryB;
  const categoryMismatch = Boolean(categoryA && categoryB && categoryA !== categoryB);
  const candidates = await getProductsByCategory(category);
  const excluded = new Set([productA.productName || productA.name, productB.productName || productB.name]
    .filter(Boolean).map(name => String(name).trim().toLowerCase()));

  const baseA = availableNumber(Number(productA.score)) ?? availableNumber(Number(productA?.nutrition?.score)) ?? 50;
  const baseB = availableNumber(Number(productB.score)) ?? availableNumber(Number(productB?.nutrition?.score)) ?? 50;
  const baselineScore = Math.max(baseA, baseB);

  const ranked = candidates.filter(product => !excluded.has(String(product.productName || '').trim().toLowerCase())).map(product => {
    const nutrition = product.nutrition || {};
    const reasons = [];
    const compared = [productA, productB];
    const lowKeys = [
      ['sugar', 'Sugar'], ['saturatedFat', 'Saturated fat'], ['sodium', 'Sodium'],
      ['calories', 'Calories'], ['totalFat', 'Fat']
    ];
    for (const [key, label] of lowKeys) {
      const candidate = valueFrom(product, key);
      if (candidate == null) continue;
      const availableCompared = compared.map(item => valueFrom(item, key)).filter(value => value != null);
      if (!availableCompared.length) continue;
      const bestCompared = Math.min(...availableCompared);
      if (candidate < bestCompared) reasons.push(`Lower ${label.toLowerCase()} than the compared products`);
    }
    const candidateProtein = valueFrom(product, 'protein');
    const comparedProtein = compared.map(item => valueFrom(item, 'protein')).filter(value => value != null);
    if (candidateProtein != null && comparedProtein.length) {
      const bestComparedProtein = Math.max(...comparedProtein);
      if (candidateProtein > bestComparedProtein) reasons.push('Better protein content');
    }

    const score = calculateComparisonScore(product);
    if (score > baselineScore) reasons.push(`Higher overall nutrition score (${score}/100)`);

    const ingredientText = (product.ingredients || []).join(' ').toLowerCase();
    if (/whole grain|wholegrain|oats|bran|seed|lentil|sprouted|legume/.test(ingredientText)) {
      reasons.push('Positive wholegrain or protein-rich ingredient profile');
    }

    const advantageCount = reasons.length;
    const meaningful = score >= baselineScore + 5 && advantageCount > 0;
    const rankingScore = score + (advantageCount * 3);
    return { ...product, score, reasons, meaningful, rankingScore };
  }).sort((a, b) => b.rankingScore - a.rankingScore || b.score - a.score);

  const meaningful = ranked.filter(product => product.meaningful);
  const alternatives = meaningful.slice(0, 3);
  return {
    category,
    categoryMismatch,
    warning: categoryMismatch ? `⚠️ These products belong to different categories. Alternative recommendations will be based on ${categoryA || category}'s category.` : null,
    demoDataset: true,
    alternatives,
    bestAlternative: alternatives[0] || null,
    message: alternatives.length ? 'SMART ALTERNATIVES' : 'No significantly better alternative was found\nin the available dataset.'
  };
}
