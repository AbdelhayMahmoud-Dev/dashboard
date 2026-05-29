/**
 * Database seed script — populates MongoDB with realistic, *coherent* business data
 * so every dashboard page looks like a SaaS product actively used by hundreds of
 * customers.
 *
 * Run:
 *   npm run seed             # add data (skips collections that are already populated)
 *   npm run seed:reset       # wipe everything first, then reseed from scratch
 *   npm run seed:large       # reset + generate a much larger dataset
 *
 *   # direct invocation with overrides:
 *   npx ts-node --transpile-only src/scripts/seed.ts --fresh --orders=1500 --customers=400 --products=150
 *
 * Design goals (what makes the data believable):
 *   - 100+ products, 300+ customers, 1000+ orders — all relationally valid.
 *   - 13 months of order history with a clear month-over-month GROWTH trend.
 *   - WEEKEND dips and Q4/holiday SEASONALITY baked into the order timeline.
 *   - Pareto economics: ~20% of products are best-sellers driving ~80% of sales;
 *     ~20% of customers (enterprise/VIP) drive most revenue.
 *   - Best-sellers, slow-movers, low-stock and out-of-stock products all coexist.
 *   - Product `totalSales` and customer `totalSpent`/`totalOrders` are DERIVED from
 *     the orders actually generated, so widgets never contradict each other.
 *   - A real admin account (admin@company.com / Admin123!) plus a small team.
 *
 * All fake names/emails/phones/addresses/descriptions come from @faker-js/faker.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { faker } from '@faker-js/faker';
import User from '../models/User';
import Product from '../models/Product';
import Customer from '../models/Customer';
import Order from '../models/Order';
import AuditLog from '../models/AuditLog';

// Deterministic output across runs — stable screenshots / demos.
faker.seed(20260529);

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const FRESH         = args.includes('--fresh');
const argNum = (name: string, fallback: number) =>
  parseInt(args.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? String(fallback), 10);

const NUM_PRODUCTS  = argNum('products', 130);
const NUM_CUSTOMERS = argNum('customers', 320);
const NUM_ORDERS    = argNum('orders', 1100);

// ── Helpers ───────────────────────────────────────────────────────────────────
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randFloat = (min: number, max: number) => parseFloat((Math.random() * (max - min) + min).toFixed(2));
const round2 = (n: number) => parseFloat(n.toFixed(2));

function weightedPick<T extends { weight: number }>(items: readonly T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

/**
 * Deterministic avatar URL — DiceBear avataaars (free, SVG, stable per seed).
 */
function avatarFor(seed: string): string {
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

/**
 * Deterministic product thumbnail — Picsum with stable per-SKU seed.
 * (Unsplash Source was shut down June 2024, so Picsum is the stable free option.)
 */
function thumbnailFor(sku: string): string {
  return `https://picsum.photos/seed/${encodeURIComponent(sku)}/400/400`;
}

// ──────────────────────────────────────────────────────────────────────────────
// TIME MODEL — growth + weekend + seasonality
// ──────────────────────────────────────────────────────────────────────────────
const DAY_MS = 86_400_000;
const NOW = new Date();

/** Weekday multiplier — B2B/SaaS commerce dips on weekends. Index 0 = Sunday. */
const WEEKDAY_FACTOR = [0.6, 1.05, 1.12, 1.12, 1.08, 1.0, 0.72];

/** Seasonal multiplier by calendar month (0 = Jan). Holiday Q4 spike, summer/Jan dip. */
const SEASONAL_FACTOR = [
  0.80, // Jan — post-holiday slump
  0.88, // Feb
  0.98, // Mar
  1.02, // Apr
  1.05, // May
  1.00, // Jun
  0.92, // Jul — summer slowdown
  0.95, // Aug
  1.08, // Sep — back to business
  1.12, // Oct
  1.38, // Nov — Black Friday / Cyber Monday
  1.52, // Dec — holiday peak
];

interface DayBucket { date: Date; weight: number }

/**
 * Build a weighted bucket per day for the trailing `horizonDays` (no future days).
 * weight = growth(recencyMonths) × weekday × seasonal × noise.
 * Growth makes recent months carry progressively more orders → upward MoM trend.
 */
function buildDayBuckets(horizonDays: number, monthlyGrowth: number): DayBucket[] {
  const buckets: DayBucket[] = [];
  for (let daysAgo = horizonDays - 1; daysAgo >= 0; daysAgo--) {
    const date = new Date(NOW.getTime() - daysAgo * DAY_MS);
    const monthsAgo = daysAgo / 30.4;
    const growth = Math.pow(monthlyGrowth, -monthsAgo); // recent ≈ 1, oldest ≪ 1
    const weekday = WEEKDAY_FACTOR[date.getDay()];
    const seasonal = SEASONAL_FACTOR[date.getMonth()];
    const noise = 0.85 + Math.random() * 0.3;
    buckets.push({ date, weight: growth * weekday * seasonal * noise });
  }
  return buckets;
}

/** Cumulative-weight sampler over day buckets, with a random intra-day timestamp. */
function makeDateSampler(buckets: DayBucket[]) {
  const cum: number[] = [];
  let acc = 0;
  for (const b of buckets) { acc += b.weight; cum.push(acc); }
  const total = acc;
  return () => {
    const r = Math.random() * total;
    // binary search
    let lo = 0, hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < r) lo = mid + 1; else hi = mid;
    }
    const day = buckets[lo].date;
    const ts = new Date(day);
    // Cap "today" to the current time; spread other days over business-ish hours.
    const isToday = day.toDateString() === NOW.toDateString();
    const maxHour = isToday ? NOW.getHours() : 23;
    ts.setHours(rand(7, Math.max(7, maxHour)), rand(0, 59), rand(0, 59), 0);
    return ts;
  };
}

// ── Curated premium product catalog (realistic flagship SKUs) ──────────────────
const PRODUCT_CATALOG: Array<{
  name: string; category: string; price: number; comparePrice?: number; description: string;
}> = [
  // SaaS / Software
  { name: 'Professional Plan — Annual', category: 'Software', price: 299.00, comparePrice: 399.00, description: 'Full access to all Pro features with annual billing. Priority support included.' },
  { name: 'Team Plan — Annual', category: 'Software', price: 799.00, comparePrice: 999.00, description: 'Up to 10 seats with advanced collaboration features and admin dashboard.' },
  { name: 'Enterprise License', category: 'Software', price: 1999.00, description: 'Unlimited seats, SSO, dedicated account manager, SLA guarantee.' },
  { name: 'API Credits Pack — 100k', category: 'Software', price: 49.00, description: '100,000 API calls, valid for 12 months. Pooled across team.' },
  { name: 'Analytics Add-on', category: 'Software', price: 79.00, description: 'Advanced analytics dashboard with custom reports and data export.' },
  { name: 'Custom Domain Setup', category: 'Services', price: 29.00, description: 'White-label custom domain with SSL certificate auto-renewal.' },

  // Electronics
  { name: 'Wireless Earbuds Pro Max', category: 'Electronics', price: 189.99, comparePrice: 249.99, description: 'Active noise cancellation, 40h battery, multipoint connect.' },
  { name: 'USB-C Hub 10-in-1', category: 'Electronics', price: 79.99, comparePrice: 109.99, description: '4K HDMI, 100W PD, SD card, 3x USB-A, ethernet.' },
  { name: '4K Webcam with Ring Light', category: 'Electronics', price: 129.99, description: 'Auto-focus, built-in microphone, plug-and-play.' },
  { name: 'Mechanical Keyboard TKL', category: 'Electronics', price: 149.00, description: 'PBT keycaps, hot-swap switches, per-key RGB, USB-C.' },
  { name: 'Ultrawide Monitor 34"', category: 'Electronics', price: 549.00, comparePrice: 699.00, description: '3440×1440 IPS, 144Hz, HDR400, USB-C 65W.' },
  { name: 'Smart LED Desk Lamp Pro', category: 'Electronics', price: 89.99, comparePrice: 119.99, description: 'Tunable white 2700K–6500K, circadian rhythm mode, USB charging.' },
  { name: 'Portable SSD 2TB', category: 'Electronics', price: 139.99, comparePrice: 179.99, description: '2000MB/s read, USB 3.2 Gen2, shock-resistant.' },
  { name: 'Gaming Mouse Wireless', category: 'Electronics', price: 119.99, description: '25K DPI sensor, 80h battery, sub-1ms wireless.' },

  // Furniture & Workspace
  { name: 'Ergonomic Mesh Chair Pro', category: 'Furniture', price: 429.00, comparePrice: 549.00, description: 'Lumbar support, 4D armrests, adjustable seat depth.' },
  { name: 'Standing Desk 60"', category: 'Furniture', price: 649.00, comparePrice: 799.00, description: 'Electric sit-stand, 3 memory presets, anti-collision.' },
  { name: 'Monitor Arm — Dual', category: 'Furniture', price: 89.99, description: 'Full motion, C-clamp + grommet, 13–34" support.' },
  { name: 'Under-Desk Cable Tray', category: 'Furniture', price: 34.99, description: 'Steel mesh, tool-free install, holds 11 lbs.' },
  { name: 'Laptop Stand Aluminum', category: 'Furniture', price: 49.99, comparePrice: 69.99, description: 'Foldable, 6 height settings, compatible with 10–17" laptops.' },

  // Clothing & Accessories
  { name: 'Merino Wool Pullover Hoodie', category: 'Clothing', price: 139.99, comparePrice: 179.99, description: '100% merino, temperature-regulating, machine washable.' },
  { name: 'Tech Fleece Joggers', category: 'Clothing', price: 89.99, description: 'Lightweight, moisture-wicking, two side pockets + back zip.' },
  { name: 'Waterproof Packable Jacket', category: 'Clothing', price: 159.99, comparePrice: 199.99, description: '10k waterproof rating, packable to shirt pocket, recycled shell.' },
  { name: 'Performance Tee 3-Pack', category: 'Clothing', price: 59.99, description: 'Anti-odor fabric, 4-way stretch, tagless.' },

  // Books & Learning
  { name: 'Designing Data-Intensive Applications', category: 'Books', price: 54.99, description: 'By Martin Kleppmann. Definitive guide to distributed systems.' },
  { name: 'System Design Interview Vol. 2', category: 'Books', price: 39.99, description: 'Step-by-step walkthroughs of 13 real-world system design problems.' },
  { name: 'The Pragmatic Programmer 20th Ed.', category: 'Books', price: 49.99, description: 'Anniversary edition with expanded content and new tips.' },
  { name: 'Atomic Habits', category: 'Books', price: 27.99, comparePrice: 34.99, description: 'By James Clear. Practical strategies for building good habits.' },
  { name: 'Staff Engineer', category: 'Books', price: 32.99, description: 'Leadership beyond the management track. By Will Larson.' },

  // Sports & Wellness
  { name: 'Resistance Bands Set 5-Pack', category: 'Sports', price: 39.99, description: 'Natural latex, 10–50 lbs, door anchor + handle accessories.' },
  { name: 'Foam Roller Pro XL', category: 'Sports', price: 54.99, comparePrice: 69.99, description: 'High-density EVA, vibrating model for deep tissue recovery.' },
  { name: 'Yoga Mat Premium 6mm', category: 'Sports', price: 79.99, description: 'Eco TPE, non-slip both sides, alignment lines.' },
  { name: 'Insulated Water Bottle 40oz', category: 'Sports', price: 44.99, comparePrice: 54.99, description: '24h cold, 12h hot, dishwasher safe lid, leak-proof.' },
  { name: 'Jump Rope — Speed Cable', category: 'Sports', price: 29.99, description: 'Adjustable length, 360° swivel bearings, aluminum handles.' },

  // Home & Garden
  { name: 'Air Purifier — HEPA H13', category: 'Home', price: 199.99, comparePrice: 249.99, description: 'Covers 500 sq ft, auto mode, CADR 230 m³/h.' },
  { name: 'Smart Plug 4-Pack', category: 'Home', price: 44.99, comparePrice: 59.99, description: 'Matter-compatible, energy monitoring, scheduling, voice control.' },
  { name: 'Pour-Over Coffee Kit', category: 'Home', price: 69.99, description: 'Includes dripper, gooseneck kettle, burr grinder, and scale.' },
  { name: 'Bamboo Cutting Board Set 3pc', category: 'Home', price: 49.99, description: 'Juice groove, built-in handles, dishwasher-safe.' },

  // Accessories
  { name: 'RFID-Blocking Slim Wallet', category: 'Accessories', price: 49.99, comparePrice: 64.99, description: 'Full-grain leather, 8 card slots, money clip, lifetime warranty.' },
  { name: 'Bamboo Wireless Charger 15W', category: 'Accessories', price: 39.99, description: 'Qi2 compatible, LED indicator, USB-C, eco-friendly bamboo.' },
  { name: 'Cable Organizer — Desktop Kit', category: 'Accessories', price: 29.99, description: '12-piece set: cable clips, ties, and under-desk organizer.' },
  { name: 'Leather Notebook A5 — 3-Pack', category: 'Accessories', price: 44.99, description: 'Dot-grid, 120 GSM fountain-pen-safe paper, lay-flat binding.' },
  { name: 'Screen Cleaning Kit Pro', category: 'Accessories', price: 19.99, description: '150ml solution, microfiber cloth, safe for all screens.' },
];

const FAKER_CATEGORIES = [
  'Electronics', 'Furniture', 'Clothing', 'Books', 'Sports',
  'Home', 'Accessories', 'Beauty', 'Toys', 'Outdoors', 'Office', 'Kitchen',
];

/** Generate additional believable products with Faker to reach the target count. */
function buildFakerProducts(count: number) {
  return Array.from({ length: Math.max(0, count) }, () => {
    const category = pick(FAKER_CATEGORIES);
    const price = round2(parseFloat(faker.commerce.price({ min: 9, max: 899 })));
    const hasCompare = Math.random() > 0.6;
    const adjective = faker.commerce.productAdjective();
    const material = faker.commerce.productMaterial();
    const product = faker.commerce.product();
    return {
      name: `${adjective} ${material} ${product}`,
      category,
      price,
      comparePrice: hasCompare ? round2(price * randFloat(1.12, 1.45)) : undefined,
      description: faker.commerce.productDescription(),
    };
  });
}

// ── Customer archetypes (Pareto: a few accounts drive most revenue) ────────────
const CUSTOMER_ARCHETYPES = [
  { weight: 5,  tier: 'enterprise', ordersShare: 9, avgOrderValue: [800, 2500] },
  { weight: 15, tier: 'vip',        ordersShare: 5, avgOrderValue: [300, 900]  },
  { weight: 30, tier: 'returning',  ordersShare: 2.5, avgOrderValue: [80, 300] },
  { weight: 50, tier: 'new',        ordersShare: 1, avgOrderValue: [40, 150]   },
] as const;

const DOMAINS = ['gmail.com', 'outlook.com', 'yahoo.com', 'icloud.com', 'proton.me', 'company.io', 'startup.co', 'acme.com'];

// International distribution — representative, not a census. ~60% US.
interface CountryEntry { code: string; weight: number; cities: [string, string][] }
const COUNTRIES: CountryEntry[] = [
  { code: 'US', weight: 60, cities: [['San Francisco','CA'],['New York','NY'],['Austin','TX'],['Seattle','WA'],['Boston','MA'],['Chicago','IL'],['Los Angeles','CA'],['Denver','CO'],['Atlanta','GA'],['Portland','OR'],['Nashville','TN'],['Miami','FL'],['Phoenix','AZ'],['Minneapolis','MN'],['Charlotte','NC'],['San Diego','CA'],['Dallas','TX'],['Houston','TX'],['Philadelphia','PA'],['Detroit','MI']] },
  { code: 'GB', weight: 8,  cities: [['London','England'],['Manchester','England'],['Edinburgh','Scotland'],['Bristol','England']] },
  { code: 'CA', weight: 7,  cities: [['Toronto','ON'],['Vancouver','BC'],['Montreal','QC'],['Calgary','AB']] },
  { code: 'AU', weight: 5,  cities: [['Sydney','NSW'],['Melbourne','VIC'],['Brisbane','QLD']] },
  { code: 'DE', weight: 5,  cities: [['Berlin','BE'],['Munich','BY'],['Hamburg','HH']] },
  { code: 'FR', weight: 4,  cities: [['Paris','IDF'],['Lyon','ARA'],['Marseille','PACA']] },
  { code: 'NL', weight: 3,  cities: [['Amsterdam','NH'],['Rotterdam','ZH']] },
  { code: 'JP', weight: 3,  cities: [['Tokyo','13'],['Osaka','27'],['Yokohama','14']] },
  { code: 'BR', weight: 2,  cities: [['São Paulo','SP'],['Rio de Janeiro','RJ']] },
  { code: 'IN', weight: 2,  cities: [['Bangalore','KA'],['Mumbai','MH'],['Delhi','DL']] },
  { code: 'SG', weight: 1,  cities: [['Singapore','SG']] },
];

const ORDER_STATUS_WEIGHTS = [
  { status: 'pending',    weight: 5  },
  { status: 'processing', weight: 12 },
  { status: 'shipped',    weight: 20 },
  { status: 'delivered',  weight: 55 },
  { status: 'cancelled',  weight: 8  },
] as const;

const PAYMENT_METHODS = ['credit_card','credit_card','credit_card','paypal','stripe','stripe','bank_transfer'] as const;

// ──────────────────────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────────────────────
async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set in .env');

  console.log('🔗 Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log(`✅ Connected to ${mongoose.connection.host}\n`);

  if (FRESH) {
    console.log('🗑️  Wiping collections...');
    await Promise.all([
      User.deleteMany({}),
      Product.deleteMany({}),
      Customer.deleteMany({}),
      Order.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);
    console.log('✅ Collections wiped\n');
  }

  // ── 1. Users / team ──────────────────────────────────────────────────────────
  console.log('👤 Seeding users...');
  // Hash once and reuse. The User pre-validate hook only re-hashes when `password`
  // is modified; on upsert we pass an already-hashed value and it is stored as-is.
  const adminHash = await bcrypt.hash('Admin123!', 12);
  const teamHash  = await bcrypt.hash('Admin@1234', 12);

  // Primary required admin — created only if it doesn't already exist (no duplicates).
  const adminUser = await User.findOneAndUpdate(
    { email: 'admin@company.com' },
    {
      $setOnInsert: {
        name: 'Admin User',
        email: 'admin@company.com',
        password: adminHash,
        role: 'super_admin',
        isActive: true,
        avatar: avatarFor('Admin User'),
        permissions: ['manage:users','manage:products','manage:orders','manage:customers','view:analytics'],
        lastLogin: new Date(),
      },
    },
    { upsert: true, new: true }
  );

  // A small, realistic team alongside the admin.
  const team: Array<{ name: string; email: string; role: 'manager' | 'viewer'; permissions: string[] }> = [
    { name: 'Sarah Kim',        email: 'manager@company.com', role: 'manager', permissions: ['manage:products','manage:orders','view:analytics'] },
    { name: 'Marcus Rodriguez', email: 'viewer@company.com',  role: 'viewer',  permissions: [] },
  ];
  for (const t of team) {
    await User.findOneAndUpdate(
      { email: t.email },
      { $setOnInsert: { ...t, password: teamHash, isActive: true, avatar: avatarFor(t.name) } },
      { upsert: true, new: true }
    );
  }
  console.log('   admin@company.com   / Admin123!   (super_admin)');
  console.log('   manager@company.com / Admin@1234  (manager)');
  console.log('   viewer@company.com  / Admin@1234  (viewer)\n');

  // Product creation timeline — products predate the orders that reference them.
  const productDateSampler = makeDateSampler(buildDayBuckets(540, 1.0));

  // ── 2. Products ────────────────────────────────────────────────────────────
  console.log('📦 Seeding products...');
  const existingProductCount = await Product.countDocuments();
  let products: Array<InstanceType<typeof Product>>;

  if (existingProductCount >= NUM_PRODUCTS) {
    products = await Product.find();
    console.log(`   Skipping — ${existingProductCount} products already exist`);
  } else {
    const catalog = [...PRODUCT_CATALOG, ...buildFakerProducts(NUM_PRODUCTS - PRODUCT_CATALOG.length)];

    const productDocs = catalog.map((p, idx) => {
      const sku = `SKU-${randomUUID().slice(0, 8).toUpperCase()}`;
      // ~20% of catalog are "hot" best-sellers (Pareto). Tracked separately below.
      const status = pick(['active','active','active','active','active','active','active','active','inactive','draft']) as 'active' | 'inactive' | 'draft';
      const createdAt = productDateSampler();
      return {
        name: p.name,
        description: p.description,
        price: p.price,
        comparePrice: p.comparePrice,
        category: p.category,
        subcategory: p.category,
        sku,
        // Real stock is recomputed after orders are generated (see step 4 backfill).
        stock: rand(20, 400),
        images: [thumbnailFor(sku)],
        thumbnail: thumbnailFor(sku),
        tags: [p.category.toLowerCase().replace(/ /g, '-'), idx % 5 === 0 ? 'featured' : 'catalog'],
        status,
        isFeatured: false,
        totalSales: 0,
        rating: randFloat(3.6, 5.0),
        reviewCount: rand(0, 50),
        createdBy: adminUser._id,
        createdAt,
        updatedAt: createdAt,
      };
    });
    products = await Product.insertMany(productDocs) as Array<InstanceType<typeof Product>>;
    console.log(`   Created ${products.length} products`);
  }
  console.log('');

  // ── 3. Customers ───────────────────────────────────────────────────────────
  console.log('🙋 Seeding customers...');
  const existingCustomerCount = await Customer.countDocuments();
  let customers: Array<InstanceType<typeof Customer>>;

  // Customer signups skew recent (growth) — drives the "new customers" curve.
  const customerDateSampler = makeDateSampler(buildDayBuckets(365, 1.16));

  if (existingCustomerCount >= NUM_CUSTOMERS) {
    customers = await Customer.find();
    console.log(`   Skipping — ${existingCustomerCount} customers already exist`);
  } else {
    const seenEmails = new Set<string>();
    const customerDocs = Array.from({ length: NUM_CUSTOMERS }, (_, i) => {
      const first = faker.person.firstName();
      const last  = faker.person.lastName();
      const fullName = `${first} ${last}`;
      const country = weightedPick(COUNTRIES);
      const [city, state] = pick(country.cities);
      const archetype = weightedPick(CUSTOMER_ARCHETYPES);
      const createdAt = customerDateSampler();

      // Guaranteed-unique email derived from the name.
      let email = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '') + `@${pick(DOMAINS)}`;
      if (seenEmails.has(email)) email = `${first}.${last}${i}`.toLowerCase().replace(/[^a-z0-9.]/g, '') + `@${pick(DOMAINS)}`;
      seenEmails.add(email);

      return {
        name:  fullName,
        email,
        phone: faker.phone.number({ style: 'national' }),
        avatar: avatarFor(fullName + i),
        status: (archetype.tier === 'enterprise' || archetype.tier === 'vip')
          ? 'active' as const
          : pick(['active','active','active','active','inactive','banned']) as 'active' | 'inactive' | 'banned',
        tags: [archetype.tier === 'enterprise' ? 'vip' : archetype.tier],
        totalOrders: 0,
        totalSpent: 0,
        address: {
          street:  faker.location.streetAddress(),
          city,
          state,
          country: country.code,
          zipCode: faker.location.zipCode(),
        },
        createdAt,
        updatedAt: createdAt,
      };
    });
    customers = await Customer.insertMany(customerDocs) as Array<InstanceType<typeof Customer>>;
    console.log(`   Created ${customers.length} customers`);
  }
  console.log('');

  // ── 4. Orders ──────────────────────────────────────────────────────────────
  console.log('🛒 Seeding orders (growth + weekend + seasonality)...');
  const existingOrderCount = await Order.countDocuments();

  if (existingOrderCount >= NUM_ORDERS) {
    console.log(`   Skipping — ${existingOrderCount} orders already exist\n`);
  } else {
    // Only sell products that are actually purchasable.
    const sellable = products.filter((p) => p.status === 'active');
    const catalogForSale = sellable.length > 0 ? sellable : products;

    // Pareto product popularity: ~20% are best-sellers (high weight), the rest are
    // long-tail / slow-movers. This yields a realistic top-products distribution.
    const productPool = catalogForSale.map((p) => ({
      product: p,
      weight: Math.random() < 0.2 ? rand(8, 20) : randFloat(0.4, 2.5),
    }));

    // Customer purchase frequency follows their archetype's ordersShare.
    const customerPool = customers.map((c) => {
      const tier = (c.tags?.[0] ?? 'new');
      const archetype = CUSTOMER_ARCHETYPES.find(a =>
        (a.tier === 'enterprise' && tier === 'vip' && Math.random() < 0.25) || a.tier === tier
      ) ?? CUSTOMER_ARCHETYPES[3];
      return { customer: c, weight: archetype.ordersShare * randFloat(0.6, 1.6) };
    });

    const orderDateSampler = makeDateSampler(buildDayBuckets(395, 1.12));

    const orderDocs = Array.from({ length: NUM_ORDERS }, () => {
      const customer = weightedPick(customerPool).customer;
      const statusEntry = weightedPick(ORDER_STATUS_WEIGHTS);
      const status = statusEntry.status;

      const numItems = weightedPick([
        { value: 1, weight: 45 }, { value: 2, weight: 28 },
        { value: 3, weight: 16 }, { value: 4, weight: 8 }, { value: 5, weight: 3 },
      ] as const).value;

      const usedProductIds = new Set<string>();
      const items = Array.from({ length: numItems }, () => {
        let product = weightedPick(productPool).product;
        // Avoid duplicate line items in one order.
        let guard = 0;
        while (usedProductIds.has(product._id.toString()) && guard++ < 5) {
          product = weightedPick(productPool).product;
        }
        usedProductIds.add(product._id.toString());
        const quantity = weightedPick([
          { value: 1, weight: 55 }, { value: 2, weight: 25 },
          { value: 3, weight: 12 }, { value: 4, weight: 5 }, { value: 5, weight: 3 },
        ] as const).value;
        return {
          product:   product._id,
          name:      product.name,
          thumbnail: product.thumbnail ?? '',
          price:     product.price,
          quantity,
          subtotal:  round2(product.price * quantity),
        };
      });

      const subtotal  = round2(items.reduce((s, i) => s + i.subtotal, 0));
      const tax       = round2(subtotal * 0.08);
      const shipping  = subtotal > 150 ? 0 : subtotal > 75 ? 7.99 : 12.99;
      const discount  = Math.random() > 0.75 ? round2(subtotal * randFloat(0.05, 0.2)) : 0;
      const total     = round2(subtotal + tax + shipping - discount);
      const createdAt = orderDateSampler();

      const paymentStatus =
        status === 'delivered' ? 'paid' :
        status === 'cancelled' ? pick(['failed','refunded','refunded'] as const) :
        status === 'shipped'   ? pick(['paid','paid','paid','pending'] as const) :
        pick(['paid','paid','pending'] as const);

      // Realistic status timeline.
      const history: Array<{ status: string; timestamp: Date; note?: string }> = [
        { status: 'pending', timestamp: createdAt },
      ];
      if (['processing','shipped','delivered'].includes(status))
        history.push({ status: 'processing', timestamp: new Date(createdAt.getTime() + rand(1,4) * 3600000) });
      if (['shipped','delivered'].includes(status))
        history.push({ status: 'shipped', timestamp: new Date(createdAt.getTime() + rand(12,48) * 3600000), note: `Tracking: ${randomUUID().slice(0,12).toUpperCase()}` });
      if (status === 'delivered')
        history.push({ status: 'delivered', timestamp: new Date(createdAt.getTime() + rand(48,144) * 3600000) });
      if (status === 'cancelled')
        history.push({ status: 'cancelled', timestamp: new Date(createdAt.getTime() + rand(1,24) * 3600000), note: 'Cancelled by customer' });

      return {
        orderNumber: `ORD-${randomUUID().slice(0, 8).toUpperCase()}`,
        customer:    customer._id,
        items,
        subtotal, tax, shipping, discount, total,
        status,
        paymentStatus,
        paymentMethod: pick(PAYMENT_METHODS),
        shippingAddress: {
          fullName: customer.name,
          address:  customer.address?.street  ?? '123 Main St',
          city:     customer.address?.city    ?? 'San Francisco',
          state:    customer.address?.state   ?? 'CA',
          country:  customer.address?.country ?? 'US',
          zipCode:  customer.address?.zipCode ?? '94105',
          phone:    customer.phone            ?? '+1 555-0000',
        },
        statusHistory: history,
        notes: Math.random() > 0.85 ? pick(['Gift — please include card','No signature required','Leave at door','Fragile contents']) : undefined,
        createdAt,
        updatedAt: history[history.length - 1].timestamp,
      };
    });

    await Order.insertMany(orderDocs);
    console.log(`   Created ${orderDocs.length} orders`);

    // ── Derive customer stats from real orders ─────────────────────────────────
    console.log('   Deriving customer statistics from orders...');
    const allOrders = await Order.find().select('customer total paymentStatus items');
    const custStats = new Map<string, { orders: number; spent: number }>();
    const prodUnits = new Map<string, number>();

    for (const order of allOrders) {
      const key = order.customer.toString();
      const entry = custStats.get(key) ?? { orders: 0, spent: 0 };
      entry.orders += 1;
      if (order.paymentStatus === 'paid') entry.spent += order.total;
      custStats.set(key, entry);

      for (const it of order.items) {
        const pid = it.product.toString();
        prodUnits.set(pid, (prodUnits.get(pid) ?? 0) + it.quantity);
      }
    }

    const custBulk = [...custStats.entries()].map(([id, { orders, spent }]) => ({
      updateOne: { filter: { _id: id }, update: { $set: { totalOrders: orders, totalSpent: round2(spent) } } },
    }));
    if (custBulk.length > 0) await Customer.bulkWrite(custBulk);

    // ── Derive product totalSales + realistic stock from real orders ───────────
    console.log('   Deriving product sales + stock levels from orders...');
    const allProductsForStock = await Product.find().select('_id');
    const prodBulk = allProductsForStock.map((p) => {
      const sold = prodUnits.get(p._id.toString()) ?? 0;
      // Stock realism: a few out-of-stock, some low-stock, rest healthy.
      const roll = Math.random();
      const stock =
        roll < 0.08 ? 0 :                 // 8% out of stock
        roll < 0.20 ? rand(1, 9) :        // 12% low stock (triggers low-stock alerts)
        rand(15, 600);                    // healthy
      return {
        updateOne: {
          filter: { _id: p._id },
          update: { $set: {
            totalSales: sold,
            stock,
            // Best-sellers (top of the long tail) get flagged as featured.
            isFeatured: sold > 60,
          } },
        },
      };
    });
    if (prodBulk.length > 0) await Product.bulkWrite(prodBulk);

    console.log('   ✅ Stats derived\n');
  }

  // ── 5. Audit log ─────────────────────────────────────────────────────────────
  console.log('📋 Seeding audit log...');
  const existingAuditCount = await AuditLog.countDocuments();
  const TARGET_AUDIT_COUNT = 90;

  if (existingAuditCount >= TARGET_AUDIT_COUNT) {
    console.log(`   Skipping — ${existingAuditCount} audit entries already exist\n`);
  } else {
    const auditableUsers = await User.find({ role: { $in: ['super_admin', 'admin', 'manager'] } }).select('_id role');

    const sampleOrders = await Order.aggregate([
      { $sample: { size: 35 } },
      { $project: { _id: 1, orderNumber: 1, status: 1, total: 1 } },
    ]) as Array<{ _id: mongoose.Types.ObjectId; orderNumber: string; status: string; total: number }>;
    const sampleProducts = await Product.aggregate([
      { $sample: { size: 25 } },
      { $project: { _id: 1, name: 1, price: 1, stock: 1 } },
    ]) as Array<{ _id: mongoose.Types.ObjectId; name: string; price: number; stock: number }>;
    const sampleCustomers = await Customer.aggregate([
      { $sample: { size: 15 } },
      { $project: { _id: 1, name: 1, email: 1 } },
    ]) as Array<{ _id: mongoose.Types.ObjectId; name: string; email: string }>;

    const USER_AGENTS = [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    ];
    const ipFor = () => `${rand(10, 220)}.${rand(0, 255)}.${rand(0, 255)}.${rand(1, 254)}`;
    const auditDate = () => {
      const f = Math.pow(Math.random(), 1.5);
      return new Date(Date.now() - (Math.floor(f * 60) * 86400 + rand(0, 86400)) * 1000);
    };

    type Entry = {
      user: mongoose.Types.ObjectId; action: string; resource: string;
      resourceId?: string; details?: Record<string, unknown>;
      ipAddress: string; userAgent: string; createdAt: Date;
    };
    const entries: Entry[] = [];

    for (const o of sampleOrders) {
      const actor = pick(auditableUsers);
      const action = pick(['order.status_changed','order.status_changed','order.status_changed','order.refunded','order.notes_updated']);
      entries.push({
        user: actor._id, action, resource: 'order', resourceId: o._id.toString(),
        details: action === 'order.status_changed'
          ? { orderNumber: o.orderNumber, from: pick(['pending','processing','shipped']), to: o.status }
          : action === 'order.refunded' ? { orderNumber: o.orderNumber, amount: o.total } : { orderNumber: o.orderNumber },
        ipAddress: ipFor(), userAgent: pick(USER_AGENTS), createdAt: auditDate(),
      });
    }
    for (const p of sampleProducts) {
      const actor = pick(auditableUsers);
      const action = pick(['product.updated','product.updated','product.price_changed','product.stock_adjusted','product.status_changed']);
      entries.push({
        user: actor._id, action, resource: 'product', resourceId: p._id.toString(),
        details: action === 'product.price_changed' ? { name: p.name, from: round2(p.price + randFloat(5, 25)), to: p.price }
          : action === 'product.stock_adjusted' ? { name: p.name, delta: rand(-50, 100), newStock: p.stock }
          : action === 'product.status_changed' ? { name: p.name, to: pick(['active','inactive','draft']) }
          : { name: p.name, fields: pick([['description'],['tags'],['comparePrice'],['rating']]) },
        ipAddress: ipFor(), userAgent: pick(USER_AGENTS), createdAt: auditDate(),
      });
    }
    for (const c of sampleCustomers) {
      const actor = pick(auditableUsers);
      entries.push({
        user: actor._id, action: pick(['customer.updated','customer.tag_added','customer.note_added','customer.status_changed']),
        resource: 'customer', resourceId: c._id.toString(), details: { name: c.name, email: c.email },
        ipAddress: ipFor(), userAgent: pick(USER_AGENTS), createdAt: auditDate(),
      });
    }
    for (let i = 0; i < 18; i++) {
      const actor = pick(auditableUsers);
      entries.push({
        user: actor._id, action: 'auth.login', resource: 'session', details: { method: 'password' },
        ipAddress: ipFor(), userAgent: pick(USER_AGENTS), createdAt: auditDate(),
      });
    }

    await AuditLog.insertMany(entries);
    console.log(`   Created ${entries.length} audit log entries\n`);
  }

  // ── 6. Summary ───────────────────────────────────────────────────────────────
  const [pCount, cCount, oCount, uCount, aCount, activeProducts, outOfStock, lowStock, paidAgg] = await Promise.all([
    Product.countDocuments(),
    Customer.countDocuments(),
    Order.countDocuments(),
    User.countDocuments(),
    AuditLog.countDocuments(),
    Product.countDocuments({ status: 'active' }),
    Product.countDocuments({ stock: 0 }),
    Product.countDocuments({ stock: { $gt: 0, $lte: 9 } }),
    Order.aggregate([{ $match: { paymentStatus: 'paid' } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
  ]);

  console.log('✅ Seed complete!\n');
  console.log('   Collection   Count');
  console.log('   ──────────── ─────');
  console.log(`   Products     ${pCount}  (active ${activeProducts}, out-of-stock ${outOfStock}, low-stock ${lowStock})`);
  console.log(`   Customers    ${cCount}`);
  console.log(`   Orders       ${oCount}`);
  console.log(`   Users        ${uCount}`);
  console.log(`   Audit log    ${aCount}`);
  console.log(`   Paid revenue $${Math.round(paidAgg[0]?.total ?? 0).toLocaleString('en-US')}`);
  console.log('\n   Login: admin@company.com / Admin123!\n');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
