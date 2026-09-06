import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const userId = process.argv[2];
  if (!userId || !(await prisma.user.findUnique({ where: { id: userId } }))) {
    throw new Error("Sign in first, then pass that user's ID to db:seed. No shared portfolio is seeded.");
  }
  const lots = [
    {
      id: "seed-aapl-1",
      ticker: "AAPL",
      shares: 8,
      purchasePrice: 165.25,
      purchaseDate: new Date("2024-05-15"),
      notes: "Core long-term position"
    },
    {
      id: "seed-aapl-2",
      ticker: "AAPL",
      shares: 4,
      purchasePrice: 188.1,
      purchaseDate: new Date("2025-02-10"),
      notes: "Added on product-cycle pullback"
    },
    {
      id: "seed-msft-1",
      ticker: "MSFT",
      shares: 5,
      purchasePrice: 320,
      purchaseDate: new Date("2024-01-22"),
      notes: "Cloud and productivity exposure"
    },
    {
      id: "seed-nvda-1",
      ticker: "NVDA",
      shares: 6,
      purchasePrice: 112.5,
      purchaseDate: new Date("2025-08-06"),
      notes: "Higher-volatility growth sleeve"
    }
  ];

  for (const lot of lots) {
    await prisma.positionLot.upsert({
      where: { id: `${userId}-${lot.id}`, userId },
      create: { ...lot, id: `${userId}-${lot.id}`, userId },
      update: { ...lot, id: `${userId}-${lot.id}` }
    });
  }

  const watchlist = [
    { ticker: "AMZN", notes: "Watch for margin expansion" },
    { ticker: "JPM", notes: "Banking bellwether" },
    { ticker: "V", notes: "Payments compounder" }
  ];

  for (const item of watchlist) {
    const assetKey = `stock:${item.ticker}`;
    await prisma.watchlistItem.upsert({
      where: { userId_assetKey: { userId, assetKey } },
      create: { ...item, userId, assetType: "stock", assetId: item.ticker, assetKey },
      update: item
    });
  }

  await prisma.appSetting.upsert({
    where: { userId_key: { userId, key: "theme" } },
    create: { userId, key: "theme", value: "system" },
    update: {}
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
