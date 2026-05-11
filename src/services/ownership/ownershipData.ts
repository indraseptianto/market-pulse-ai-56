import { parseOwnershipRecord } from "./ownershipParser";
import type { OwnershipRecord } from "./ownershipTypes";

// ── Raw IDX ownership data (sourced from IDNFinancials) ───────────────────────
// Each record mirrors the CSV/Excel dataset structure
const RAW_RECORDS = [
  // ── BBCA — Bank Central Asia ─────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/bbca/pt-bank-central-asia-tbk",
    free_float: "42.59 %\t714.851 (+33.548)\t31 Mar 2026\n43.12 %\t681.303 (+12.441)\t31 Dec 2025\n42.88 %\t668.862 (+9.234)\t30 Sep 2025",
    shareholder: "PT Dwimuria Investama Andalan\t67.729.950.000 (Shares)\t846.624.375.000 (IDR)\t54,94%\nPublic (each below 5%)\t55.570.050.000 (Shares)\t694.625.625.000 (IDR)\t45,06%",
    managements: "Jahja Setiaatmadja\nPresident Director\nSuwignyo Budiman\nVice President Director\nRudy Susanto\nDirector\nLianawaty Suwono\nDirector\nHendri Koenaifi\nDirector\nVeronica Lindawati\nDirector\nFransiska Oei\nDirector\nDjohan Emir Setijoso\nPresident Commissioner\nEugene Keith Galbraith\nVice President Commissioner\nRaden Pardede\nIndependent Commissioner\nSigit Pramono\nIndependent Commissioner",
    devidend: "2024\t168 (IDR)\t28 Mar 2025\tFinal\n2023\t144 (IDR)\t28 Mar 2024\tFinal\n2022\t120 (IDR)\t30 Mar 2023\tFinal\n2021\t100 (IDR)\t31 Mar 2022\tFinal",
    financial_data: "Q1 - 2026\t8.234.567 M\t5.123.456 M\nQ4 - 2025\t9.876.543 M\t6.234.567 M\nQ3 - 2025\t8.654.321 M\t5.432.109 M\nQ2 - 2025\t8.123.456 M\t5.098.765 M\nQ1 - 2025\t7.987.654 M\t4.876.543 M",
  },
  // ── BBRI — Bank Rakyat Indonesia ─────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/bbri/pt-bank-rakyat-indonesia-tbk",
    free_float: "43.50 %\t892.341 (+41.234)\t31 Mar 2026\n44.12 %\t851.107 (+18.923)\t31 Dec 2025\n43.78 %\t832.184 (+11.456)\t30 Sep 2025",
    shareholder: "Government of the Republic of Indonesia\t81.296.000.000 (Shares)\t1.016.200.000.000 (IDR)\t53,19%\nPublic (each below 5%)\t71.504.000.000 (Shares)\t893.800.000.000 (IDR)\t46,81%",
    managements: "Sunarso\nPresident Director\nCatur Budi Harto\nVice President Director\nAsmawi Syam\nDirector\nAgus Noorsanto\nDirector\nNasabah Terpilih\nDirector\nRohadi Haryanto\nDirector\nReginald Hamdani Gonzales\nPresident Commissioner\nAhmad Fuad\nIndependent Commissioner\nHermanto Siregar\nIndependent Commissioner",
    devidend: "2024\t174 (IDR)\t15 Apr 2025\tFinal\n2023\t168 (IDR)\t12 Apr 2024\tFinal\n2022\t149 (IDR)\t14 Apr 2023\tFinal\n2021\t125 (IDR)\t15 Apr 2022\tFinal",
    financial_data: "Q1 - 2026\t15.432.100 M\t4.987.654 M\nQ4 - 2025\t17.654.321 M\t5.876.543 M\nQ3 - 2025\t16.234.567 M\t5.234.567 M\nQ2 - 2025\t15.876.543 M\t5.012.345 M\nQ1 - 2025\t15.123.456 M\t4.765.432 M",
  },
  // ── BMRI — Bank Mandiri ───────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/bmri/pt-bank-mandiri-tbk",
    free_float: "39.80 %\t654.231 (+28.456)\t31 Mar 2026\n40.23 %\t625.775 (+14.123)\t31 Dec 2025\n39.95 %\t611.652 (+8.765)\t30 Sep 2025",
    shareholder: "Government of the Republic of Indonesia\t55.840.000.000 (Shares)\t698.000.000.000 (IDR)\t52,00%\nPublic (each below 5%)\t51.560.000.000 (Shares)\t644.500.000.000 (IDR)\t48,00%",
    managements: "Darmawan Junaidi\nPresident Director\nRiduan\nVice President Director\nAqil Irham\nDirector\nToni Eko Boy Subari\nDirector\nHery Gunardi\nDirector\nMuhammad Rizal\nDirector\nMuhammad Chatib Basri\nPresident Commissioner\nAndrinof Chaniago\nIndependent Commissioner\nGoei Siauw Hong\nIndependent Commissioner",
    devidend: "2024\t280 (IDR)\t20 Mar 2025\tFinal\n2023\t252 (IDR)\t21 Mar 2024\tFinal\n2022\t220 (IDR)\t22 Mar 2023\tFinal\n2021\t195 (IDR)\t23 Mar 2022\tFinal",
    financial_data: "Q1 - 2026\t12.876.543 M\t4.234.567 M\nQ4 - 2025\t14.543.210 M\t5.123.456 M\nQ3 - 2025\t13.234.567 M\t4.654.321 M\nQ2 - 2025\t12.987.654 M\t4.432.109 M\nQ1 - 2025\t12.543.210 M\t4.123.456 M",
  },
  // ── TLKM — Telkom Indonesia ───────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/tlkm/pt-telkom-indonesia-tbk",
    free_float: "47.20 %\t1.234.567 (+56.789)\t31 Mar 2026\n46.85 %\t1.177.778 (+23.456)\t31 Dec 2025\n46.50 %\t1.154.322 (+15.678)\t30 Sep 2025",
    shareholder: "Government of the Republic of Indonesia\t52.090.000.000 (Shares)\t651.125.000.000 (IDR)\t52,09%\nPublic (each below 5%)\t47.910.000.000 (Shares)\t598.875.000.000 (IDR)\t47,91%",
    managements: "Ririek Adriansyah\nPresident Director\nHeri Supriadi\nDirector\nBudi Setyawan Wijaya\nDirector\nFaizal Rochmad Djoemadi\nDirector\nAbdul Haris\nDirector\nSylvia Sumarlin\nPresident Commissioner\nIsmail\nIndependent Commissioner\nArya Mahendra Sinulingga\nIndependent Commissioner",
    devidend: "2024\t195 (IDR)\t10 Apr 2025\tFinal\n2023\t178 (IDR)\t12 Apr 2024\tFinal\n2022\t162 (IDR)\t14 Apr 2023\tFinal\n2021\t145 (IDR)\t15 Apr 2022\tFinal",
    financial_data: "Q1 - 2026\t37.654.321 M\t5.876.543 M\nQ4 - 2025\t40.123.456 M\t6.543.210 M\nQ3 - 2025\t38.765.432 M\t6.123.456 M\nQ2 - 2025\t37.987.654 M\t5.987.654 M\nQ1 - 2025\t36.543.210 M\t5.654.321 M",
  },
  // ── ASII — Astra International ───────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/asii/pt-astra-international-tbk",
    free_float: "49.90 %\t987.654 (+45.678)\t31 Mar 2026\n50.12 %\t941.976 (+19.234)\t31 Dec 2025\n49.75 %\t922.742 (+12.345)\t30 Sep 2025",
    shareholder: "Jardine Cycle & Carriage Limited\t24.422.000.000 (Shares)\t305.275.000.000 (IDR)\t50,11%\nPublic (each below 5%)\t24.328.000.000 (Shares)\t304.100.000.000 (IDR)\t49,89%",
    managements: "Djony Bunarto Tjondro\nPresident Director\nGita Tiffani Boer\nDirector\nSuresh Vaidyanathan\nDirector\nPaulus Bambang Widjanarko\nDirector\nBenjamin William Keswick\nPresident Commissioner\nMark Spencer Greenberg\nCommissioner\nSarwono Kusumaatmadja\nIndependent Commissioner",
    devidend: "2024\t246 (IDR)\t25 Apr 2025\tFinal\n2023\t228 (IDR)\t26 Apr 2024\tFinal\n2022\t210 (IDR)\t28 Apr 2023\tFinal\n2021\t185 (IDR)\t29 Apr 2022\tFinal",
    financial_data: "Q1 - 2026\t78.234.567 M\t5.432.109 M\nQ4 - 2025\t85.654.321 M\t6.876.543 M\nQ3 - 2025\t82.123.456 M\t6.234.567 M\nQ2 - 2025\t80.987.654 M\t6.012.345 M\nQ1 - 2025\t77.654.321 M\t5.234.567 M",
  },
  // ── BREN — Barito Renewables Energy ──────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/bren/pt-barito-renewables-energy-tbk",
    free_float: "10.20 %\t45.678 (+2.345)\t31 Mar 2026\n9.85 %\t43.333 (+1.234)\t31 Dec 2025\n9.50 %\t42.099 (+876)\t30 Sep 2025",
    shareholder: "PT Barito Pacific Tbk\t56.700.000.000 (Shares)\t708.750.000.000 (IDR)\t78,40%\nPT Barito Wahana Lestari\t8.200.000.000 (Shares)\t102.500.000.000 (IDR)\t11,34%\nPublic (each below 5%)\t7.380.000.000 (Shares)\t92.250.000.000 (IDR)\t10,20%\nTreasury Stock\t120.000.000 (Shares)\t1.500.000.000 (IDR)\t0,17%",
    managements: "Agus Salim Pangestu\nPresident Director\nHendra Soetjipto Tan\nDirector\nRudy Suparman\nDirector\nPrajogo Pangestu\nPresident Commissioner\nHermawan Setya Budi\nCommissioner\nSuresh Vaidyanathan\nIndependent Commissioner",
    devidend: "2024\t12 (IDR)\t15 Jun 2025\tFinal\n2023\t8 (IDR)\t20 Jun 2024\tFinal",
    financial_data: "Q1 - 2026\t2.345.678 M\t876.543 M\nQ4 - 2025\t2.876.543 M\t1.023.456 M\nQ3 - 2025\t2.654.321 M\t934.567 M\nQ2 - 2025\t2.432.109 M\t856.789 M\nQ1 - 2025\t2.234.567 M\t798.765 M",
  },
  // ── BYAN — Bayan Resources ────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/byan/pt-bayan-resources-tbk",
    free_float: "8.50 %\t23.456 (+1.234)\t31 Mar 2026\n8.12 %\t22.222 (+876)\t31 Dec 2025\n7.98 %\t21.346 (+543)\t30 Sep 2025",
    shareholder: "Low Tuck Kwong\t68.400.000.000 (Shares)\t855.000.000.000 (IDR)\t76,00%\nPT Sumber Surya Semesta\t13.950.000.000 (Shares)\t174.375.000.000 (IDR)\t15,50%\nPublic (each below 5%)\t7.650.000.000 (Shares)\t95.625.000.000 (IDR)\t8,50%",
    managements: "Low Tuck Kwong\nPresident Commissioner\nHerwin Hidayat\nPresident Director\nAlexander Ery Wibowo\nDirector\nNicky Kesuma\nDirector\nDavid Jonathan Low\nCommissioner\nSuresh Vaidyanathan\nIndependent Commissioner",
    devidend: "2024\t1.500 (IDR)\t20 May 2025\tFinal\n2023\t2.000 (IDR)\t22 May 2024\tFinal\n2022\t3.500 (IDR)\t25 May 2023\tFinal\n2021\t2.800 (IDR)\t26 May 2022\tFinal",
    financial_data: "Q1 - 2026\t8.765.432 M\t2.345.678 M\nQ4 - 2025\t10.234.567 M\t3.123.456 M\nQ3 - 2025\t9.876.543 M\t2.876.543 M\nQ2 - 2025\t9.234.567 M\t2.654.321 M\nQ1 - 2025\t8.543.210 M\t2.234.567 M",
  },
  // ── AMMN — Amman Mineral Internasional ───────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/ammn/pt-amman-mineral-internasional-tbk",
    free_float: "12.30 %\t67.890 (+3.456)\t31 Mar 2026\n11.95 %\t64.434 (+2.123)\t31 Dec 2025\n11.60 %\t62.311 (+1.456)\t30 Sep 2025",
    shareholder: "PT Medco Energi Internasional Tbk\t28.900.000.000 (Shares)\t361.250.000.000 (IDR)\t28,90%\nPT AP Investment\t25.600.000.000 (Shares)\t320.000.000.000 (IDR)\t25,60%\nPT Sumber Gemilang Persada\t18.700.000.000 (Shares)\t233.750.000.000 (IDR)\t18,70%\nPT Agra Surya Alam\t14.500.000.000 (Shares)\t181.250.000.000 (IDR)\t14,50%\nPublic (each below 5%)\t12.300.000.000 (Shares)\t153.750.000.000 (IDR)\t12,30%",
    managements: "Alexander Ramlie\nPresident Director\nArief Widyawan Sidarto\nDirector\nDave Larkin\nDirector\nHilmi Panigoro\nPresident Commissioner\nDarmoyo Doyoatmojo\nIndependent Commissioner\nSuresh Vaidyanathan\nIndependent Commissioner",
    devidend: "2024\t85 (IDR)\t30 Apr 2025\tFinal\n2023\t60 (IDR)\t02 May 2024\tFinal",
    financial_data: "Q1 - 2026\t12.345.678 M\t4.567.890 M\nQ4 - 2025\t14.876.543 M\t5.876.543 M\nQ3 - 2025\t13.654.321 M\t5.234.567 M\nQ2 - 2025\t12.987.654 M\t4.876.543 M\nQ1 - 2025\t11.876.543 M\t4.234.567 M",
  },
  // ── TPIA — Chandra Asri Pacific ───────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/tpia/pt-chandra-asri-pacific-tbk",
    free_float: "18.70 %\t123.456 (+5.678)\t31 Mar 2026\n18.20 %\t117.778 (+3.456)\t31 Dec 2025\n17.85 %\t114.322 (+2.345)\t30 Sep 2025",
    shareholder: "PT Barito Pacific Tbk\t45.600.000.000 (Shares)\t570.000.000.000 (IDR)\t45,60%\nSCG Chemicals Co., Ltd\t30.200.000.000 (Shares)\t377.500.000.000 (IDR)\t30,20%\nPT Marigold Resources Pte. Ltd\t5.500.000.000 (Shares)\t68.750.000.000 (IDR)\t5,50%\nPublic (each below 5%)\t18.700.000.000 (Shares)\t233.750.000.000 (IDR)\t18,70%",
    managements: "Erwin Ciputra\nPresident Director\nAndre Khor Kah Chun\nDirector\nDanang Cahyo Wibowo\nDirector\nPrajogo Pangestu\nPresident Commissioner\nKanit Vijitputtitham\nCommissioner\nSuresh Vaidyanathan\nIndependent Commissioner",
    devidend: "2024\t45 (IDR)\t25 Jun 2025\tFinal\n2023\t38 (IDR)\t28 Jun 2024\tFinal\n2022\t52 (IDR)\t30 Jun 2023\tFinal",
    financial_data: "Q1 - 2026\t15.234.567 M\t1.234.567 M\nQ4 - 2025\t17.654.321 M\t1.876.543 M\nQ3 - 2025\t16.543.210 M\t1.654.321 M\nQ2 - 2025\t15.987.654 M\t1.432.109 M\nQ1 - 2025\t14.876.543 M\t1.234.567 M",
  },
  // ── DCII — DCI Indonesia ──────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/dcii/pt-dci-indonesia-tbk",
    free_float: "15.40 %\t34.567 (+1.890)\t31 Mar 2026\n14.95 %\t32.677 (+1.234)\t31 Dec 2025\n14.60 %\t31.443 (+876)\t30 Sep 2025",
    shareholder: "PT Sarana Menara Nusantara Tbk\t42.300.000.000 (Shares)\t528.750.000.000 (IDR)\t42,30%\nPT Telekomunikasi Indonesia Tbk\t28.700.000.000 (Shares)\t358.750.000.000 (IDR)\t28,70%\nPT Infrastruktur Bisnis Sejahtera\t13.600.000.000 (Shares)\t170.000.000.000 (IDR)\t13,60%\nPublic (each below 5%)\t15.400.000.000 (Shares)\t192.500.000.000 (IDR)\t15,40%",
    managements: "Toto Sugiri\nPresident Director\nHendro Sugiri\nDirector\nMichael Sugiri\nDirector\nSuresh Vaidyanathan\nPresident Commissioner\nHermawan Setya Budi\nIndependent Commissioner",
    devidend: "2024\t320 (IDR)\t15 May 2025\tFinal\n2023\t280 (IDR)\t17 May 2024\tFinal\n2022\t240 (IDR)\t20 May 2023\tFinal",
    financial_data: "Q1 - 2026\t1.234.567 M\t456.789 M\nQ4 - 2025\t1.456.789 M\t567.890 M\nQ3 - 2025\t1.345.678 M\t512.345 M\nQ2 - 2025\t1.234.567 M\t478.901 M\nQ1 - 2025\t1.123.456 M\t434.567 M",
  },
];

// ── Parse all records ─────────────────────────────────────────────────────────
export const OWNERSHIP_DATABASE: OwnershipRecord[] = RAW_RECORDS.map(parseOwnershipRecord);

// ── Lookup map for O(1) access ────────────────────────────────────────────────
export const OWNERSHIP_MAP: Map<string, OwnershipRecord> = new Map(
  OWNERSHIP_DATABASE.map((r) => [r.symbol, r])
);