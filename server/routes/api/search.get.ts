// Nitro server route: GET /api/search?q=BBCA
// Works on Vercel (Nitro node-server preset) and locally.
// Falls back to built-in IDX stock list when API key is missing.

const BASE_URL = "https://api.datasectors.com/api";

const POPULAR_STOCKS = [
  { id: "BBCA", symbol: "BBCA", description: "Bank Central Asia Tbk", exchange: "IDX", type: "stock" },
  { id: "BBRI", symbol: "BBRI", description: "Bank Rakyat Indonesia Tbk", exchange: "IDX", type: "stock" },
  { id: "BMRI", symbol: "BMRI", description: "Bank Mandiri Tbk", exchange: "IDX", type: "stock" },
  { id: "TLKM", symbol: "TLKM", description: "Telkom Indonesia Tbk", exchange: "IDX", type: "stock" },
  { id: "ASII", symbol: "ASII", description: "Astra International Tbk", exchange: "IDX", type: "stock" },
  { id: "BREN", symbol: "BREN", description: "Barito Renewables Energy Tbk", exchange: "IDX", type: "stock" },
  { id: "BYAN", symbol: "BYAN", description: "Bayan Resources Tbk", exchange: "IDX", type: "stock" },
  { id: "AMMN", symbol: "AMMN", description: "Amman Mineral Internasional Tbk", exchange: "IDX", type: "stock" },
  { id: "TPIA", symbol: "TPIA", description: "Chandra Asri Pacific Tbk", exchange: "IDX", type: "stock" },
  { id: "DCII", symbol: "DCII", description: "DCI Indonesia Tbk", exchange: "IDX", type: "stock" },
  { id: "GOTO", symbol: "GOTO", description: "GoTo Gojek Tokopedia Tbk", exchange: "IDX", type: "stock" },
  { id: "UNVR", symbol: "UNVR", description: "Unilever Indonesia Tbk", exchange: "IDX", type: "stock" },
  { id: "ICBP", symbol: "ICBP", description: "Indofood CBP Sukses Makmur Tbk", exchange: "IDX", type: "stock" },
  { id: "INDF", symbol: "INDF", description: "Indofood Sukses Makmur Tbk", exchange: "IDX", type: "stock" },
  { id: "KLBF", symbol: "KLBF", description: "Kalbe Farma Tbk", exchange: "IDX", type: "stock" },
  { id: "MDKA", symbol: "MDKA", description: "Merdeka Copper Gold Tbk", exchange: "IDX", type: "stock" },
  { id: "ADRO", symbol: "ADRO", description: "Adaro Energy Indonesia Tbk", exchange: "IDX", type: "stock" },
  { id: "PTBA", symbol: "PTBA", description: "Bukit Asam Tbk", exchange: "IDX", type: "stock" },
  { id: "SMGR", symbol: "SMGR", description: "Semen Indonesia Tbk", exchange: "IDX", type: "stock" },
  { id: "PGAS", symbol: "PGAS", description: "Perusahaan Gas Negara Tbk", exchange: "IDX", type: "stock" },
  { id: "ANTM", symbol: "ANTM", description: "Aneka Tambang Tbk", exchange: "IDX", type: "stock" },
  { id: "BBNI", symbol: "BBNI", description: "Bank Negara Indonesia Tbk", exchange: "IDX", type: "stock" },
  { id: "BSDE", symbol: "BSDE", description: "Bumi Serpong Damai Tbk", exchange: "IDX", type: "stock" },
  { id: "CPIN", symbol: "CPIN", description: "Charoen Pokphand Indonesia Tbk", exchange: "IDX", type: "stock" },
  { id: "ERAA", symbol: "ERAA", description: "Erajaya Swasembada Tbk", exchange: "IDX", type: "stock" },
  { id: "EXCL", symbol: "EXCL", description: "XL Axiata Tbk", exchange: "IDX", type: "stock" },
  { id: "HMSP", symbol: "HMSP", description: "HM Sampoerna Tbk", exchange: "IDX", type: "stock" },
  { id: "INCO", symbol: "INCO", description: "Vale Indonesia Tbk", exchange: "IDX", type: "stock" },
  { id: "INKP", symbol: "INKP", description: "Indah Kiat Pulp & Paper Tbk", exchange: "IDX", type: "stock" },
  { id: "ISAT", symbol: "ISAT", description: "Indosat Tbk", exchange: "IDX", type: "stock" },
  { id: "JPFA", symbol: "JPFA", description: "Japfa Comfeed Indonesia Tbk", exchange: "IDX", type: "stock" },
  { id: "MAPI", symbol: "MAPI", description: "Mitra Adiperkasa Tbk", exchange: "IDX", type: "stock" },
  { id: "MEDC", symbol: "MEDC", description: "Medco Energi Internasional Tbk", exchange: "IDX", type: "stock" },
  { id: "MNCN", symbol: "MNCN", description: "Media Nusantara Citra Tbk", exchange: "IDX", type: "stock" },
  { id: "PNBN", symbol: "PNBN", description: "Bank Pan Indonesia Tbk", exchange: "IDX", type: "stock" },
  { id: "PWON", symbol: "PWON", description: "Pakuwon Jati Tbk", exchange: "IDX", type: "stock" },
  { id: "SCMA", symbol: "SCMA", description: "Surya Citra Media Tbk", exchange: "IDX", type: "stock" },
  { id: "SIDO", symbol: "SIDO", description: "Industri Jamu dan Farmasi Sido Muncul Tbk", exchange: "IDX", type: "stock" },
  { id: "SMRA", symbol: "SMRA", description: "Summarecon Agung Tbk", exchange: "IDX", type: "stock" },
  { id: "TBIG", symbol: "TBIG", description: "Tower Bersama Infrastructure Tbk", exchange: "IDX", type: "stock" },
  { id: "TOWR", symbol: "TOWR", description: "Sarana Menara Nusantara Tbk", exchange: "IDX", type: "stock" },
  { id: "UNTR", symbol: "UNTR", description: "United Tractors Tbk", exchange: "IDX", type: "stock" },
  { id: "WIKA", symbol: "WIKA", description: "Wijaya Karya Tbk", exchange: "IDX", type: "stock" },
  { id: "WSKT", symbol: "WSKT", description: "Waskita Karya Tbk", exchange: "IDX", type: "stock" },
  { id: "CUAN", symbol: "CUAN", description: "Petrindo Jaya Kreasi Tbk", exchange: "IDX", type: "stock" },
  { id: "DSSA", symbol: "DSSA", description: "Dian Swastatika Sentosa Tbk", exchange: "IDX", type: "stock" },
  { id: "HRUM", symbol: "HRUM", description: "Harum Energy Tbk", exchange: "IDX", type: "stock" },
  { id: "ITMG", symbol: "ITMG", description: "Indo Tambangraya Megah Tbk", exchange: "IDX", type: "stock" },
  { id: "MIKA", symbol: "MIKA", description: "Mitra Keluarga Karyasehat Tbk", exchange: "IDX", type: "stock" },
  { id: "RAJA", symbol: "RAJA", description: "Rukun Raharja Tbk", exchange: "IDX", type: "stock" },
  { id: "ACES", symbol: "ACES", description: "Ace Hardware Indonesia Tbk", exchange: "IDX", type: "stock" },
  { id: "AKRA", symbol: "AKRA", description: "AKR Corporindo Tbk", exchange: "IDX", type: "stock" },
  { id: "AMRT", symbol: "AMRT", description: "Sumber Alfaria Trijaya Tbk", exchange: "IDX", type: "stock" },
  { id: "ARNA", symbol: "ARNA", description: "Arwana Citramulia Tbk", exchange: "IDX", type: "stock" },
  { id: "BBTN", symbol: "BBTN", description: "Bank Tabungan Negara Tbk", exchange: "IDX", type: "stock" },
  { id: "BDMN", symbol: "BDMN", description: "Bank Danamon Indonesia Tbk", exchange: "IDX", type: "stock" },
  { id: "BMTR", symbol: "BMTR", description: "Global Mediacom Tbk", exchange: "IDX", type: "stock" },
  { id: "BRPT", symbol: "BRPT", description: "Barito Pacific Tbk", exchange: "IDX", type: "stock" },
  { id: "BTPS", symbol: "BTPS", description: "Bank BTPN Syariah Tbk", exchange: "IDX", type: "stock" },
  { id: "CTRA", symbol: "CTRA", description: "Ciputra Development Tbk", exchange: "IDX", type: "stock" },
  { id: "EMTK", symbol: "EMTK", description: "Elang Mahkota Teknologi Tbk", exchange: "IDX", type: "stock" },
  { id: "GGRM", symbol: "GGRM", description: "Gudang Garam Tbk", exchange: "IDX", type: "stock" },
  { id: "HEAL", symbol: "HEAL", description: "Medikaloka Hermina Tbk", exchange: "IDX", type: "stock" },
  { id: "INTP", symbol: "INTP", description: "Indocement Tunggal Prakarsa Tbk", exchange: "IDX", type: "stock" },
  { id: "JSMR", symbol: "JSMR", description: "Jasa Marga Tbk", exchange: "IDX", type: "stock" },
  { id: "LSIP", symbol: "LSIP", description: "PP London Sumatra Indonesia Tbk", exchange: "IDX", type: "stock" },
  { id: "MYOR", symbol: "MYOR", description: "Mayora Indah Tbk", exchange: "IDX", type: "stock" },
  { id: "NISP", symbol: "NISP", description: "Bank OCBC NISP Tbk", exchange: "IDX", type: "stock" },
  { id: "PNLF", symbol: "PNLF", description: "Panin Financial Tbk", exchange: "IDX", type: "stock" },
  { id: "SRTG", symbol: "SRTG", description: "Saratoga Investama Sedaya Tbk", exchange: "IDX", type: "stock" },
  { id: "TKIM", symbol: "TKIM", description: "Pabrik Kertas Tjiwi Kimia Tbk", exchange: "IDX", type: "stock" },
  { id: "ULTJ", symbol: "ULTJ", description: "Ultra Jaya Milk Industry Tbk", exchange: "IDX", type: "stock" },
  { id: "WIIM", symbol: "WIIM", description: "Wismilak Inti Makmur Tbk", exchange: "IDX", type: "stock" },
];

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const q = String(query.q ?? "").trim();

  if (!q) {
    return { data: [], source: "empty" };
  }

  const apiKey = process.env.DATASECTORS_API_KEY;

  // Try DataSectors API
  if (apiKey) {
    try {
      const dsUrl = new URL(`${BASE_URL}/search/market`);
      dsUrl.searchParams.set("query", q);

      const res = await $fetch<Record<string, unknown>>(dsUrl.toString(), {
        headers: {
          "X-API-Key": apiKey,
          Accept: "application/json",
        },
        timeout: 8000,
      }).catch(() => null);

      if (res) {
        const raw = Array.isArray(res)
          ? res
          : Array.isArray(res.data)
            ? (res.data as Record<string, unknown>[])
            : [];

        if (raw.length > 0) {
          const results = raw
            .map((item: Record<string, unknown>) => ({
              id: String(item.id ?? `${item.exchange}:${item.symbol}`),
              symbol: String(item.symbol ?? ""),
              description: String(item.description ?? item.name ?? ""),
              exchange: String(item.exchange ?? "IDX"),
              type: String(item.type ?? "stock"),
            }))
            .filter((r) => r.symbol !== "");

          return { data: results, source: "api" };
        }
      }
    } catch (err) {
      console.warn("[/api/search] DataSectors error:", err);
    }
  }

  // Fallback: filter built-in list
  const upper = q.toUpperCase();
  const fallback = POPULAR_STOCKS.filter(
    (s) =>
      s.symbol.startsWith(upper) ||
      s.symbol.includes(upper) ||
      s.description.toUpperCase().includes(upper)
  );

  return {
    data: fallback,
    source: apiKey ? "fallback" : "no-api-key",
  };
});
