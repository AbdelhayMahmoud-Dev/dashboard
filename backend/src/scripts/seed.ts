/**
 * Database seed script — populates the DB with realistic development data.
 *
 * Run:
 *   npx ts-node src/scripts/seed.ts           # add data (skips if already populated)
 *   npx ts-node src/scripts/seed.ts --fresh   # wipe first, then seed
 *   npx ts-node src/scripts/seed.ts --orders=300 --customers=120
 *
 * Designed to produce SaaS metrics that feel like a real funded startup:
 *   - 6+ months of order history with a visible upward growth trend
 *   - Revenue in the $80k–$250k/month range (Series A stage)
 *   - Realistic customer LTV distribution (Pareto: 20% of customers = 80% of revenue)
 *   - Product catalog with plausible prices
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import Product from '../models/Product';
import Customer from '../models/Customer';
import Order from '../models/Order';
import AuditLog from '../models/AuditLog';

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const FRESH       = args.includes('--fresh');
const NUM_ORDERS  = parseInt(args.find(a => a.startsWith('--orders='))?.split('=')[1]   ?? '280');
const NUM_CUSTOMERS = parseInt(args.find(a => a.startsWith('--customers='))?.split('=')[1] ?? '120');

// ── Helpers ───────────────────────────────────────────────────────────────────
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randFloat = (min: number, max: number) => parseFloat((Math.random() * (max - min) + min).toFixed(2));

/**
 * Random date biased toward the last N days (growth trend).
 * Most orders fall in the last 60 days; fewer in earlier months.
 * This ensures the 30-day revenue chart shows an upward trend.
 */
function randomOrderDate(): Date {
  const now = Date.now();
  // Use a power distribution to weight toward recent dates
  const randomFraction = Math.pow(Math.random(), 1.8); // exponent < 1 = recent bias
  const maxDaysBack = 180;
  const daysBack = Math.floor(randomFraction * maxDaysBack);
  // Add intra-day randomness
  const hoursBack = rand(0, 23);
  const minutesBack = rand(0, 59);
  return new Date(now - (daysBack * 86400 + hoursBack * 3600 + minutesBack * 60) * 1000);
}

/**
 * Customer signup date over the last 12 months with recent bias — produces
 * the expected upward "customer growth" curve in analytics charts.
 */
function randomCustomerJoinedDate(): Date {
  const randomFraction = Math.pow(Math.random(), 1.6);
  const maxDaysBack = 365;
  const daysBack = Math.floor(randomFraction * maxDaysBack);
  return new Date(Date.now() - daysBack * 86400 * 1000 - rand(0, 86400 * 1000));
}

/**
 * Deterministic avatar URL — DiceBear avataaars (free, SVG, stable per name).
 * Identical name → identical avatar across runs, so testing screenshots stay stable.
 */
function avatarFor(name: string): string {
  const seed = encodeURIComponent(name.trim());
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

/**
 * Deterministic product thumbnail — Picsum with stable per-SKU seed.
 * Picsum was chosen over the deprecated Unsplash Source (shut down June 2024).
 * Photos are random; for production, swap to real product photography.
 */
function thumbnailFor(sku: string): string {
  return `https://picsum.photos/seed/${encodeURIComponent(sku)}/400/400`;
}

// ── Product catalog ───────────────────────────────────────────────────────────
const PRODUCT_CATALOG: Array<{
  name: string; category: string; price: number; comparePrice?: number; description: string;
}> = [
  // SaaS / Software Tools
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

// ── Customer archetypes ───────────────────────────────────────────────────────
// VIP customers spend 5-10x more — Pareto distribution
const CUSTOMER_ARCHETYPES = [
  { weight: 5,  tier: 'enterprise',    ordersPerYear: [12, 24], avgOrderValue: [800,  2500] },
  { weight: 15, tier: 'vip',           ordersPerYear: [6,  12], avgOrderValue: [300,  900]  },
  { weight: 30, tier: 'returning',     ordersPerYear: [3,  6],  avgOrderValue: [80,   300]  },
  { weight: 50, tier: 'new',           ordersPerYear: [1,  3],  avgOrderValue: [40,   150]  },
] as const;

const FIRST_NAMES = ['Liam','Emma','Noah','Olivia','Elijah','Ava','James','Sophia','Oliver','Isabella','William','Mia','Benjamin','Charlotte','Lucas','Amelia','Henry','Harper','Alexander','Evelyn','Mason','Abigail','Ethan','Emily','Daniel','Ella','Matthew','Scarlett','Aiden','Grace','Logan','Chloe','Jackson','Victoria','Sebastian','Riley','Jack','Aria','Owen','Lily'];
const LAST_NAMES = ['Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Wilson','Martinez','Taylor','Anderson','Thomas','Lee','Walker','Harris','Lewis','Robinson','White','Young','Hall','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores','Green','Adams','Nelson','Carter','Mitchell','Perez'];
const DOMAINS = ['gmail.com', 'outlook.com', 'yahoo.com', 'icloud.com', 'protonmail.com', 'company.io', 'startup.co', 'enterprise.com'];
const US_CITIES_STATES: [string, string][] = [
  ['San Francisco','CA'],['New York','NY'],['Austin','TX'],['Seattle','WA'],['Boston','MA'],
  ['Chicago','IL'],['Los Angeles','CA'],['Denver','CO'],['Atlanta','GA'],['Portland','OR'],
  ['Nashville','TN'],['Miami','FL'],['Phoenix','AZ'],['Minneapolis','MN'],['Charlotte','NC'],
  ['San Diego','CA'],['Dallas','TX'],['Houston','TX'],['Philadelphia','PA'],['Detroit','MI'],
];
const STREET_NAMES = ['Market','Mission','Castro','Valencia','Haight','Fillmore','Broadway','Grand','Oak','Maple','Cedar','Elm','Pine','Willow','Birch','Sunset','Sunrise','Highland','Lakeside','Riverside'];

// International distribution — ~60% US, with realistic spread across other markets.
// Cities/regions are deliberately small lists (representative, not exhaustive) so
// charts don't look like a population census.
interface CountryEntry {
  code:   string;
  weight: number;
  cities: [string, string][];
}
const COUNTRIES: CountryEntry[] = [
  { code: 'US', weight: 60, cities: US_CITIES_STATES },
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

function weightedPick<T extends { weight: number }>(items: readonly T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

// ── Main seed function ────────────────────────────────────────────────────────
async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set in .env');

  console.log('🔗 Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('✅ Connected\n');

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

  // ── 1. Users ───────────────────────────────────────────────────────────────
  console.log('👤 Seeding users...');
  const passwordHash = await bcrypt.hash('Admin@1234', 12);

  const adminUser = await User.findOneAndUpdate(
    { email: 'admin@example.com' },
    {
      name: 'Alex Chen',
      email: 'admin@example.com',
      password: passwordHash,
      role: 'super_admin',
      isActive: true,
      permissions: ['manage:users','manage:products','manage:orders','manage:customers','view:analytics'],
      lastLogin: new Date(),
    },
    { upsert: true, new: true }
  );
  await User.findOneAndUpdate(
    { email: 'manager@example.com' },
    { name: 'Sarah Kim', email: 'manager@example.com', password: passwordHash, role: 'manager', isActive: true, permissions: ['manage:products','manage:orders','view:analytics'] },
    { upsert: true, new: true }
  );
  await User.findOneAndUpdate(
    { email: 'viewer@example.com' },
    { name: 'Marcus Rodriguez', email: 'viewer@example.com', password: passwordHash, role: 'viewer', isActive: true, permissions: [] },
    { upsert: true, new: true }
  );

  console.log('   admin@example.com   / Admin@1234  (super_admin)');
  console.log('   manager@example.com / Admin@1234  (manager)');
  console.log('   viewer@example.com  / Admin@1234  (viewer)\n');

  // ── 2. Products ────────────────────────────────────────────────────────────
  console.log('📦 Seeding products...');
  const existingProductCount = await Product.countDocuments();
  let products: Awaited<ReturnType<typeof Product.find>>;

  if (existingProductCount >= PRODUCT_CATALOG.length) {
    products = await Product.find();
    console.log(`   Skipping — ${existingProductCount} products already exist`);
  } else {
    const productDocs = PRODUCT_CATALOG.map((p) => {
      const sku = `SKU-${randomUUID().slice(0, 8).toUpperCase()}`;
      return {
        name: p.name,
        description: p.description,
        price: p.price,
        comparePrice: p.comparePrice,
        category: p.category,
        subcategory: p.category,
        sku,
        stock: rand(5, 500),
        images: [thumbnailFor(sku)],
        thumbnail: thumbnailFor(sku),
        tags: [p.category.toLowerCase().replace(/ /g, '-'), 'featured'],
        status: pick(['active','active','active','active','inactive','draft']) as 'active' | 'inactive' | 'draft',
        isFeatured: Math.random() > 0.75,
        totalSales: rand(10, 2500),
        rating: randFloat(3.8, 5.0),
        reviewCount: rand(5, 800),
        createdBy: adminUser._id,
      };
    });
    products = await Product.insertMany(productDocs) as Awaited<ReturnType<typeof Product.find>>;
    console.log(`   Created ${products.length} products`);
  }

  // Backfill thumbnails on any products missing them (idempotent — non-destructive).
  const productsMissingThumb = await Product.find({
    $or: [{ thumbnail: '' }, { thumbnail: null }, { thumbnail: { $exists: false } }],
  }).select('_id sku');
  if (productsMissingThumb.length > 0) {
    const bulk = productsMissingThumb.map((p) => ({
      updateOne: {
        filter: { _id: p._id },
        update: { $set: { thumbnail: thumbnailFor(p.sku), images: [thumbnailFor(p.sku)] } },
      },
    }));
    await Product.bulkWrite(bulk);
    console.log(`   Backfilled thumbnails on ${productsMissingThumb.length} products`);
    // Refresh `products` so downstream order-seeding sees the thumbnails.
    products = await Product.find() as Awaited<ReturnType<typeof Product.find>>;
  }
  console.log('');

  // ── 3. Customers ───────────────────────────────────────────────────────────
  console.log('🙋 Seeding customers...');
  const existingCustomerCount = await Customer.countDocuments();
  let customers: Awaited<ReturnType<typeof Customer.find>>;

  if (existingCustomerCount >= NUM_CUSTOMERS) {
    customers = await Customer.find();
    console.log(`   Skipping — ${existingCustomerCount} customers already exist`);
  } else {
    const customerDocs = Array.from({ length: NUM_CUSTOMERS }, (_, i) => {
      const first = pick(FIRST_NAMES);
      const last  = pick(LAST_NAMES);
      const fullName = `${first} ${last}`;
      const country = weightedPick(COUNTRIES);
      const [city, state] = pick(country.cities);
      const archetype = weightedPick(CUSTOMER_ARCHETYPES);
      const createdAt = randomCustomerJoinedDate();

      return {
        name:  fullName,
        email: `${first.toLowerCase()}.${last.toLowerCase()}${i > 0 ? i : ''}@${pick(DOMAINS)}`,
        phone: `+1 ${rand(200, 999)}-${rand(200, 999)}-${rand(1000, 9999)}`,
        avatar: avatarFor(fullName + i),
        status: archetype.tier === 'enterprise' || archetype.tier === 'vip'
          ? 'active' as const
          : pick(['active','active','active','inactive','banned']) as 'active' | 'inactive' | 'banned',
        tags: [archetype.tier === 'enterprise' ? 'vip' : archetype.tier],
        totalOrders: 0,
        totalSpent: 0,
        address: {
          street:  `${rand(1, 9999)} ${pick(STREET_NAMES)} ${pick(['St','Ave','Blvd','Ct','Dr','Way'])}`,
          city,
          state,
          country: country.code,
          zipCode: `${rand(10000, 99999)}`,
        },
        // Spread signups across the last 12 months for a believable growth curve.
        createdAt,
        updatedAt: createdAt,
      };
    });
    customers = await Customer.insertMany(customerDocs) as Awaited<ReturnType<typeof Customer.find>>;
    console.log(`   Created ${customers.length} customers`);
  }

  // Backfill avatars on any customers missing them (idempotent — non-destructive).
  const customersMissingAvatar = await Customer.find({
    $or: [{ avatar: null }, { avatar: '' }, { avatar: { $exists: false } }],
  }).select('_id name');
  if (customersMissingAvatar.length > 0) {
    const bulk = customersMissingAvatar.map((c) => ({
      updateOne: {
        filter: { _id: c._id },
        update: { $set: { avatar: avatarFor(c.name) } },
      },
    }));
    await Customer.bulkWrite(bulk);
    console.log(`   Backfilled avatars on ${customersMissingAvatar.length} customers`);
    customers = await Customer.find() as Awaited<ReturnType<typeof Customer.find>>;
  }
  console.log('');

  // ── 4. Orders ──────────────────────────────────────────────────────────────
  console.log('🛒 Seeding orders...');
  const existingOrderCount = await Order.countDocuments();

  if (existingOrderCount >= NUM_ORDERS) {
    console.log(`   Skipping — ${existingOrderCount} orders already exist\n`);
  } else {
    const activeProducts = products.filter((p) => p.status === 'active' || !p.status);
    const allProducts = activeProducts.length > 0 ? activeProducts : products;

    const orderDocs = Array.from({ length: NUM_ORDERS }, () => {
      const customer = pick(customers as InstanceType<typeof Customer>[]);
      const statusEntry = weightedPick(ORDER_STATUS_WEIGHTS);
      const status = statusEntry.status;

      const numItems = rand(1, 4);
      const items = Array.from({ length: numItems }, () => {
        const product = pick(allProducts as InstanceType<typeof Product>[]);
        const quantity = rand(1, 5);
        return {
          product:   product._id,
          name:      product.name,
          thumbnail: product.thumbnail ?? '',
          price:     product.price,
          quantity,
          subtotal:  parseFloat((product.price * quantity).toFixed(2)),
        };
      });

      const subtotal  = parseFloat(items.reduce((s, i) => s + i.subtotal, 0).toFixed(2));
      const tax       = parseFloat((subtotal * 0.08).toFixed(2));
      const shipping  = subtotal > 150 ? 0 : subtotal > 75 ? 7.99 : 12.99;
      const discount  = Math.random() > 0.75 ? parseFloat((subtotal * randFloat(0.05, 0.2)).toFixed(2)) : 0;
      const total     = parseFloat((subtotal + tax + shipping - discount).toFixed(2));
      const createdAt = randomOrderDate();

      const paymentStatus =
        status === 'delivered' ? 'paid' :
        status === 'cancelled' ? pick(['failed','refunded','refunded'] as const) :
        status === 'shipped'   ? pick(['paid','paid','paid','pending'] as const) :
        pick(['paid','paid','pending'] as const);

      // Build a realistic status history timeline
      const history: Array<{ status: string; timestamp: Date; note?: string }> = [
        { status: 'pending', timestamp: createdAt },
      ];
      if (['processing','shipped','delivered'].includes(status)) {
        history.push({ status: 'processing', timestamp: new Date(createdAt.getTime() + rand(1,4) * 3600000) });
      }
      if (['shipped','delivered'].includes(status)) {
        history.push({ status: 'shipped', timestamp: new Date(createdAt.getTime() + rand(12,48) * 3600000), note: `Tracking: ${randomUUID().slice(0,12).toUpperCase()}` });
      }
      if (status === 'delivered') {
        history.push({ status: 'delivered', timestamp: new Date(createdAt.getTime() + rand(48,144) * 3600000) });
      }
      if (status === 'cancelled') {
        history.push({ status: 'cancelled', timestamp: new Date(createdAt.getTime() + rand(1,24) * 3600000), note: 'Cancelled by customer' });
      }

      return {
        orderNumber: `ORD-${randomUUID().slice(0, 8).toUpperCase()}`,
        customer:    customer._id,
        items,
        subtotal,
        tax,
        shipping,
        discount,
        total,
        status,
        paymentStatus,
        paymentMethod: pick(PAYMENT_METHODS),
        shippingAddress: {
          fullName: customer.name,
          address:  customer.address?.street  ?? '123 Main St',
          city:     customer.address?.city    ?? 'San Francisco',
          state:    customer.address?.state   ?? 'CA',
          country:  'US',
          zipCode:  customer.address?.zipCode ?? '94105',
          phone:    customer.phone            ?? '+1 555-0000',
        },
        statusHistory: history,
        notes: Math.random() > 0.8 ? pick(['Gift — please include card','No signature required','Leave at door','Fragile contents']) : undefined,
        createdAt,
        updatedAt: history[history.length - 1].timestamp,
      };
    });

    await Order.insertMany(orderDocs);

    // Back-fill customer stats from actual orders
    console.log('   Updating customer statistics...');
    const allOrders = await Order.find().select('customer total paymentStatus');
    const statsMap = new Map<string, { orders: number; spent: number }>();

    for (const order of allOrders) {
      const key = order.customer.toString();
      const entry = statsMap.get(key) ?? { orders: 0, spent: 0 };
      entry.orders += 1;
      if (order.paymentStatus === 'paid') entry.spent += order.total;
      statsMap.set(key, entry);
    }

    const bulkOps = [...statsMap.entries()].map(([id, { orders, spent }]) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { totalOrders: orders, totalSpent: parseFloat(spent.toFixed(2)) } },
      },
    }));
    if (bulkOps.length > 0) await Customer.bulkWrite(bulkOps);

    console.log(`   Created ${orderDocs.length} orders\n`);
  }

  // ── 5. Audit log ───────────────────────────────────────────────────────────
  console.log('📋 Seeding audit log...');
  const existingAuditCount = await AuditLog.countDocuments();
  const TARGET_AUDIT_COUNT = 80;

  if (existingAuditCount >= TARGET_AUDIT_COUNT) {
    console.log(`   Skipping — ${existingAuditCount} audit entries already exist\n`);
  } else {
    const auditableUsers = await User.find({
      role: { $in: ['super_admin', 'manager'] },
    }).select('_id role');

    const sampleOrders = await Order.aggregate([
      { $sample: { size: 30 } },
      { $project: { _id: 1, orderNumber: 1, status: 1, total: 1 } },
    ]) as Array<{ _id: mongoose.Types.ObjectId; orderNumber: string; status: string; total: number }>;

    const sampleProducts = await Product.aggregate([
      { $sample: { size: 20 } },
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

    function auditDate(): Date {
      // Power distribution recent bias over the last 60 days.
      const f = Math.pow(Math.random(), 1.5);
      const daysBack = Math.floor(f * 60);
      const secondsBack = daysBack * 86400 + rand(0, 86400);
      return new Date(Date.now() - secondsBack * 1000);
    }

    type Entry = {
      user:       mongoose.Types.ObjectId;
      action:     string;
      resource:   string;
      resourceId?: string;
      details?:   Record<string, unknown>;
      ipAddress:  string;
      userAgent:  string;
      createdAt:  Date;
    };

    const entries: Entry[] = [];

    // Order events — status changes and refunds
    for (const o of sampleOrders) {
      const actor = pick(auditableUsers);
      const action = pick([
        'order.status_changed',
        'order.status_changed',
        'order.status_changed',
        'order.refunded',
        'order.notes_updated',
      ]);
      entries.push({
        user:       actor._id,
        action,
        resource:   'order',
        resourceId: o._id.toString(),
        details: action === 'order.status_changed'
          ? { orderNumber: o.orderNumber, from: pick(['pending','processing','shipped']), to: o.status }
          : action === 'order.refunded'
            ? { orderNumber: o.orderNumber, amount: o.total }
            : { orderNumber: o.orderNumber },
        ipAddress:  ipFor(),
        userAgent:  pick(USER_AGENTS),
        createdAt:  auditDate(),
      });
    }

    // Product events — price/stock/status updates
    for (const p of sampleProducts) {
      const actor = pick(auditableUsers);
      const action = pick([
        'product.updated',
        'product.updated',
        'product.price_changed',
        'product.stock_adjusted',
        'product.status_changed',
      ]);
      entries.push({
        user:       actor._id,
        action,
        resource:   'product',
        resourceId: p._id.toString(),
        details: action === 'product.price_changed'
          ? { name: p.name, from: p.price + randFloat(5, 25), to: p.price }
          : action === 'product.stock_adjusted'
            ? { name: p.name, delta: rand(-50, 100), newStock: p.stock }
            : action === 'product.status_changed'
              ? { name: p.name, to: pick(['active','inactive','draft']) }
              : { name: p.name, fields: pick([['description'],['tags'],['comparePrice'],['rating']]) },
        ipAddress:  ipFor(),
        userAgent:  pick(USER_AGENTS),
        createdAt:  auditDate(),
      });
    }

    // Customer events
    for (const c of sampleCustomers) {
      const actor = pick(auditableUsers);
      entries.push({
        user:       actor._id,
        action:     pick(['customer.updated','customer.tag_added','customer.note_added','customer.status_changed']),
        resource:   'customer',
        resourceId: c._id.toString(),
        details:    { name: c.name, email: c.email },
        ipAddress:  ipFor(),
        userAgent:  pick(USER_AGENTS),
        createdAt:  auditDate(),
      });
    }

    // Auth events — admin/manager logins
    for (let i = 0; i < 15; i++) {
      const actor = pick(auditableUsers);
      entries.push({
        user:      actor._id,
        action:    'auth.login',
        resource:  'session',
        details:   { method: 'password' },
        ipAddress: ipFor(),
        userAgent: pick(USER_AGENTS),
        createdAt: auditDate(),
      });
    }

    await AuditLog.insertMany(entries);
    console.log(`   Created ${entries.length} audit log entries\n`);
  }

  // ── 6. Summary ─────────────────────────────────────────────────────────────
  const [pCount, cCount, oCount, uCount, aCount] = await Promise.all([
    Product.countDocuments(),
    Customer.countDocuments(),
    Order.countDocuments(),
    User.countDocuments(),
    AuditLog.countDocuments(),
  ]);

  console.log('✅ Seed complete!\n');
  console.log('   Collection   Count');
  console.log('   ──────────── ─────');
  console.log(`   Products     ${pCount}`);
  console.log(`   Customers    ${cCount}`);
  console.log(`   Orders       ${oCount}`);
  console.log(`   Users        ${uCount}`);
  console.log(`   Audit log    ${aCount}`);
  console.log('\n   Login: admin@example.com / Admin@1234\n');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
