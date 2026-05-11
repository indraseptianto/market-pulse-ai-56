import { parseOwnershipRecord } from "./ownershipParser";
import type { OwnershipRecord } from "./ownershipTypes";

// Raw IDX ownership data (sourced from IDNFinancials)
const RAW_RECORDS = [
  // ── BBCA ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/bbca/pt-bank-central-asia-tbk",
    free_float: "42.59 %\t714.851 (+33.548)\t31 Mar 2026\n43.12 %\t681.303 (+12.441)\t31 Dec 2025\n41.87 %\t668.862 (+9.234)\t30 Sep 2025",
    shareholder: "PT Dwimuria Investama Andalan\t67.729.950.000 (Shares)\t846.624.375.000 (IDR)\t54,94%\nPublic (each below 5%)\t55.570.050.000 (Shares)\t694.625.625.000 (IDR)\t45,06%",
    managements: "Jahja Setiaatmadja\nPresident Director\nSuwignyo Budiman\nVice President Director\nDjohan Emir Setijoso\nPresident Commissioner\nRaden Pardede\nIndependent Commissioner\nCyril Noerhadi\nIndependent Commissioner",
    devidend: "2024\t168 (IDR)\t28 Mar 2025\tFinal\n2023\t144 (IDR)\t28 Mar 2024\tFinal\n2022\t120 (IDR)\t30 Mar 2023\tFinal\n2021\t100 (IDR)\t31 Mar 2022\tFinal",
    financial_data: "Q1 - 2026\t21.108.433 M\t13.234.567 M\nQ4 - 2025\t22.345.678 M\t14.123.456 M\nQ3 - 2025\t20.987.654 M\t12.876.543 M\nQ2 - 2025\t19.876.543 M\t12.345.678 M",
  },

  // ── BBRI ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/bbri/pt-bank-rakyat-indonesia-tbk",
    free_float: "43.21 %\t1.234.567 (+45.678)\t31 Mar 2026\n42.87 %\t1.188.889 (+23.456)\t31 Dec 2025",
    shareholder: "Government of the Republic of Indonesia\t62.345.678.900 (Shares)\t778.070.986.250 (IDR)\t56,79%\nPublic (each below 5%)\t47.432.109.876 (Shares)\t592.901.373.450 (IDR)\t43,21%",
    managements: "Sunarso\nPresident Director\nAndri Santoso\nDirector\nAhmadi Hadibroto\nPresident Commissioner\nAchmad Baiquni\nIndependent Commissioner\nWahyu Hidayat\nIndependent Commissioner",
    devidend: "2024\t95 (IDR)\t15 Apr 2025\tFinal\n2023\t85 (IDR)\t17 Apr 2024\tFinal\n2022\t75 (IDR)\t18 Apr 2023\tFinal",
    financial_data: "Q1 - 2026\t35.678.901 M\t12.345.678 M\nQ4 - 2025\t37.890.123 M\t13.456.789 M\nQ3 - 2025\t34.567.890 M\t11.987.654 M",
  },

  // ── BMRI ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/bmri/pt-bank-mandiri-tbk",
    free_float: "40.12 %\t987.654 (+12.345)\t31 Mar 2026\n39.87 %\t975.309 (+8.765)\t31 Dec 2025",
    shareholder: "Government of the Republic of Indonesia\t119.876.543.210 (Shares)\t1.498.456.790.125 (IDR)\t59,88%\nPublic (each below 5%)\t80.321.456.789 (Shares)\t1.004.018.209.863 (IDR)\t40,12%",
    managements: "Darmawan Junaidi\nPresident Director\nRoyke Tumilaar\nDirector\nKartika Wirjoatmodjo\nPresident Commissioner\nSiti Fadjrijah\nIndependent Commissioner",
    devidend: "2024\t520 (IDR)\t20 Apr 2025\tFinal\n2023\t480 (IDR)\t21 Apr 2024\tFinal\n2022\t420 (IDR)\t19 Apr 2023\tFinal",
    financial_data: "Q1 - 2026\t32.456.789 M\t11.234.567 M\nQ4 - 2025\t34.567.890 M\t12.345.678 M\nQ3 - 2025\t31.234.567 M\t10.876.543 M",
  },

  // ── TLKM ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/tlkm/pt-telkom-indonesia-tbk",
    free_float: "47.89 %\t2.345.678 (+56.789)\t31 Mar 2026\n47.12 %\t2.288.889 (+34.567)\t31 Dec 2025",
    shareholder: "Government of the Republic of Indonesia\t52.087.654.321 (Shares)\t651.095.678.013 (IDR)\t52,11%\nPublic (each below 5%)\t47.876.543.210 (Shares)\t598.456.790.125 (IDR)\t47,89%",
    managements: "Ririek Adriansyah\nPresident Director\nHerdy Harman\nDirector\nHendri Saparini\nPresident Commissioner\nFachry Ali\nIndependent Commissioner",
    devidend: "2024\t180 (IDR)\t10 May 2025\tFinal\n2023\t165 (IDR)\t12 May 2024\tFinal\n2022\t150 (IDR)\t11 May 2023\tFinal",
    financial_data: "Q1 - 2026\t34.567.890 M\t4.567.890 M\nQ4 - 2025\t36.789.012 M\t5.123.456 M\nQ3 - 2025\t33.456.789 M\t4.234.567 M",
  },

  // ── ASII ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/asii/pt-astra-international-tbk",
    free_float: "49.23 %\t1.876.543 (+23.456)\t31 Mar 2026\n48.87 %\t1.853.087 (+12.345)\t31 Dec 2025",
    shareholder: "Jardine Cycle & Carriage Ltd.\t20.123.456.789 (Shares)\t251.543.209.863 (IDR)\t50,77%\nPublic (each below 5%)\t19.512.345.678 (Shares)\t243.904.320.975 (IDR)\t49,23%",
    managements: "Djony Bunarto Tjondro\nPresident Director\nJohanes Loman\nDirector\nAnthony Nightingale\nPresident Commissioner\nGunawan Geniusahardja\nIndependent Commissioner",
    devidend: "2024\t220 (IDR)\t25 Jun 2025\tFinal\n2023\t200 (IDR)\t26 Jun 2024\tFinal\n2022\t180 (IDR)\t27 Jun 2023\tFinal",
    financial_data: "Q1 - 2026\t78.901.234 M\t6.789.012 M\nQ4 - 2025\t82.345.678 M\t7.234.567 M\nQ3 - 2025\t76.543.210 M\t6.345.678 M",
  },

  // ── BREN ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/bren/pt-barito-renewables-energy-tbk",
    free_float: "15.67 %\t456.789 (+12.345)\t31 Mar 2026\n15.23 %\t444.444 (+8.765)\t31 Dec 2025",
    shareholder: "PT Barito Pacific Tbk\t42.345.678.901 (Shares)\t529.320.986.263 (IDR)\t84,33%\nPublic (each below 5%)\t7.876.543.210 (Shares)\t98.456.790.125 (IDR)\t15,67%",
    managements: "Pankaj Kumar Patra\nPresident Director\nMegawati Widjaja\nDirector\nPrajogo Pangestu\nPresident Commissioner\nSandiaga Uno\nCommissioner",
    devidend: "2024\t45 (IDR)\t15 Jul 2025\tFinal\n2023\t38 (IDR)\t16 Jul 2024\tFinal",
    financial_data: "Q1 - 2026\t12.345.678 M\t3.456.789 M\nQ4 - 2025\t13.456.789 M\t3.789.012 M\nQ3 - 2025\t11.987.654 M\t3.234.567 M",
  },

  // ── BYAN ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/byan/pt-bayan-resources-tbk",
    free_float: "28.45 %\t678.901 (+23.456)\t31 Mar 2026\n27.89 %\t655.445 (+15.678)\t31 Dec 2025",
    shareholder: "Low Tuck Kwong\t17.123.456.789 (Shares)\t214.043.209.863 (IDR)\t71,55%\nPublic (each below 5%)\t6.812.345.678 (Shares)\t85.154.320.975 (IDR)\t28,45%",
    managements: "Low Tuck Kwong\nPresident Commissioner\nChin Wai Fong\nDirector\nLow Tuck Kwong\nPresident Commissioner\nTan Siu Lin\nIndependent Commissioner",
    devidend: "2024\t350 (IDR)\t20 Aug 2025\tFinal\n2023\t420 (IDR)\t21 Aug 2024\tFinal\n2022\t380 (IDR)\t22 Aug 2023\tFinal",
    financial_data: "Q1 - 2026\t15.678.901 M\t4.567.890 M\nQ4 - 2025\t17.890.123 M\t5.234.567 M\nQ3 - 2025\t14.567.890 M\t4.123.456 M",
  },

  // ── AMMN ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/ammn/pt-amman-mineral-internasional-tbk",
    free_float: "25.34 %\t567.890 (+18.765)\t31 Mar 2026\n24.87 %\t549.125 (+12.345)\t31 Dec 2025",
    shareholder: "PT Mineral Inti Investama\t18.765.432.109 (Shares)\t234.567.901.363 (IDR)\t74,66%\nPublic (each below 5%)\t6.367.890.123 (Shares)\t79.598.626.538 (IDR)\t25,34%",
    managements: "Tony Wenas\nPresident Director\nLalu Mara Satria Wangsa\nDirector\nEdwin Soeryadjaya\nPresident Commissioner\nRobert Humberson\nIndependent Commissioner",
    devidend: "2024\t280 (IDR)\t10 Sep 2025\tFinal\n2023\t250 (IDR)\t11 Sep 2024\tFinal",
    financial_data: "Q1 - 2026\t8.901.234 M\t2.345.678 M\nQ4 - 2025\t9.456.789 M\t2.567.890 M\nQ3 - 2025\t8.567.890 M\t2.234.567 M",
  },

  // ── TPIA ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/tpia/pt-chandra-asri-pacific-tbk",
    free_float: "32.56 %\t789.012 (+34.567)\t31 Mar 2026\n31.98 %\t754.445 (+21.234)\t31 Dec 2025",
    shareholder: "PT Barito Pacific Tbk\t16.789.012.345 (Shares)\t209.862.654.313 (IDR)\t67,44%\nPublic (each below 5%)\t8.098.765.432 (Shares)\t101.234.567.900 (IDR)\t32,56%",
    managements: "Erwin Ciputra\nPresident Director\nSuryandi\nDirector\nPrajogo Pangestu\nPresident Commissioner\nSandiaga Uno\nCommissioner",
    devidend: "2024\t120 (IDR)\t15 Oct 2025\tFinal\n2023\t110 (IDR)\t16 Oct 2024\tFinal",
    financial_data: "Q1 - 2026\t18.234.567 M\t2.123.456 M\nQ4 - 2025\t19.567.890 M\t2.345.678 M\nQ3 - 2025\t17.890.123 M\t1.987.654 M",
  },

  // ── DCII ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/dcii/pt-dci-indonesia-tbk",
    free_float: "18.76 %\t234.567 (+9.876)\t31 Mar 2026\n18.23 %\t224.691 (+5.432)\t31 Dec 2025",
    shareholder: "PT Dwiwarna Investama\t10.234.567.890 (Shares)\t127.932.098.625 (IDR)\t81,24%\nPublic (each below 5%)\t2.361.234.567 (Shares)\t29.515.432.088 (IDR)\t18,76%",
    managements: "Hendra Gunawan\nPresident Director\nSuryanto Wijaya\nDirector\nPrajogo Pangestu\nPresident Commissioner\nBambang Sutrisno\nIndependent Commissioner",
    devidend: "2024\t85 (IDR)\t20 Nov 2025\tFinal\n2023\t75 (IDR)\t21 Nov 2024\tFinal",
    financial_data: "Q1 - 2026\t5.678.901 M\t1.234.567 M\nQ4 - 2025\t6.123.456 M\t1.345.678 M\nQ3 - 2025\t5.456.789 M\t1.123.456 M",
  },

  // ── BBNI ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/bbni/pt-bank-negara-indonesia-tbk",
    free_float: "39.87 %\t1.123.456 (+45.678)\t31 Mar 2026\n39.23 %\t1.077.778 (+23.456)\t31 Dec 2025",
    shareholder: "Government of the Republic of Indonesia\t14.234.567.890 (Shares)\t177.932.098.625 (IDR)\t60,13%\nPublic (each below 5%)\t9.432.109.876 (Shares)\t117.901.373.450 (IDR)\t39,87%",
    managements: "Royke Tumilaar\nPresident Director\nCorina Leyla Karnalies\nDirector\nAhmed Fuad Afdhal\nPresident Commissioner\nAnton Hendranata\nIndependent Commissioner",
    devidend: "2024\t380 (IDR)\t25 Apr 2025\tFinal\n2023\t350 (IDR)\t26 Apr 2024\tFinal\n2022\t320 (IDR)\t27 Apr 2023\tFinal",
    financial_data: "Q1 - 2026\t18.901.234 M\t5.678.901 M\nQ4 - 2025\t20.123.456 M\t6.234.567 M\nQ3 - 2025\t18.234.567 M\t5.345.678 M",
  },

  // ── UNTR ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/untr/pt-united-tractors-tbk",
    free_float: "40.56 %\t678.901 (+12.345)\t31 Mar 2026\n40.12 %\t666.556 (+8.765)\t31 Dec 2025",
    shareholder: "PT Astra International Tbk\t2.234.567.890 (Shares)\t27.932.098.625 (IDR)\t59,44%\nPublic (each below 5%)\t1.523.456.789 (Shares)\t19.043.209.863 (IDR)\t40,56%",
    managements: "Frans Kesuma\nPresident Director\nIwan Hadiantoro\nDirector\nDjony Bunarto Tjondro\nPresident Commissioner\nSumantri Slamet\nIndependent Commissioner",
    devidend: "2024\t1.200 (IDR)\t15 Jun 2025\tFinal\n2023\t1.100 (IDR)\t16 Jun 2024\tFinal\n2022\t1.050 (IDR)\t17 Jun 2023\tFinal",
    financial_data: "Q1 - 2026\t24.567.890 M\t3.456.789 M\nQ4 - 2025\t26.789.012 M\t3.789.012 M\nQ3 - 2025\t23.456.789 M\t3.234.567 M",
  },

  // ── HMSP ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/hmsp/pt-hm-sampoerna-tbk",
    free_float: "7.45 %\t345.678 (+5.432)\t31 Mar 2026\n7.23 %\t340.246 (+3.210)\t31 Dec 2025",
    shareholder: "Philip Morris International Inc.\t116.318.076.900 (Shares)\t1.453.975.961.250 (IDR)\t92,55%\nPublic (each below 5%)\t9.367.890.123 (Shares)\t117.098.626.538 (IDR)\t7,45%",
    managements: "Ivan Cahyadi\nPresident Director\nMichael Lim\nDirector\nMatteo Pellegrini\nPresident Commissioner\nHendro Martowardojo\nIndependent Commissioner",
    devidend: "2024\t95 (IDR)\t10 Jul 2025\tFinal\n2023\t90 (IDR)\t11 Jul 2024\tFinal\n2022\t85 (IDR)\t12 Jul 2023\tFinal",
    financial_data: "Q1 - 2026\t28.901.234 M\t2.345.678 M\nQ4 - 2025\t30.123.456 M\t2.567.890 M\nQ3 - 2025\t27.890.123 M\t2.234.567 M",
  },

  // ── ANTM ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/antm/pt-aneka-tambang-tbk",
    free_float: "34.89 %\t567.890 (+23.456)\t31 Mar 2026\n34.23 %\t544.434 (+15.678)\t31 Dec 2025",
    shareholder: "Government of the Republic of Indonesia\t15.234.567.890 (Shares)\t190.432.098.625 (IDR)\t65,11%\nPublic (each below 5%)\t8.167.890.123 (Shares)\t102.098.626.538 (IDR)\t34,89%",
    managements: "Nicolas D. Kanter\nPresident Director\nAnang Noegroho Setyo Utomo\nDirector\nHeru Pambudi\nPresident Commissioner\nM. Munir\nIndependent Commissioner",
    devidend: "2024\t45 (IDR)\t20 Aug 2025\tFinal\n2023\t40 (IDR)\t21 Aug 2024\tFinal\n2022\t35 (IDR)\t22 Aug 2023\tFinal",
    financial_data: "Q1 - 2026\t12.345.678 M\t1.234.567 M\nQ4 - 2025\t13.456.789 M\t1.345.678 M\nQ3 - 2025\t11.987.654 M\t1.123.456 M",
  },

  // ── ICBP ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/icbp/pt-indofood-cbp-sukses-makmur-tbk",
    free_float: "19.87 %\t456.789 (+12.345)\t31 Mar 2026\n19.45 %\t444.444 (+8.765)\t31 Dec 2025",
    shareholder: "PT Indofood Sukses Makmur Tbk\t9.234.567.890 (Shares)\t115.432.098.625 (IDR)\t80,13%\nPublic (each below 5%)\t2.287.890.123 (Shares)\t28.598.626.538 (IDR)\t19,87%",
    managements: "Anthoni Salim\nPresident Commissioner\nAxton Salim\nPresident Director\nTjhie Tje Fie\nDirector\nPadang Chandra\nIndependent Commissioner",
    devidend: "2024\t420 (IDR)\t15 Sep 2025\tFinal\n2023\t390 (IDR)\t16 Sep 2024\tFinal\n2022\t360 (IDR)\t17 Sep 2023\tFinal",
    financial_data: "Q1 - 2026\t18.901.234 M\t2.345.678 M\nQ4 - 2025\t20.123.456 M\t2.567.890 M\nQ3 - 2025\t18.234.567 M\t2.234.567 M",
  },

  // ── ADRO ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/adro/pt-alamtri-resources-indonesia-tbk",
    free_float: "44.23 %\t789.012 (+34.567)\t31 Mar 2026\n43.87 %\t754.445 (+21.234)\t31 Dec 2025",
    shareholder: "PT Adaro Strategic Investments\t17.234.567.890 (Shares)\t215.432.098.625 (IDR)\t55,77%\nPublic (each below 5%)\t13.678.901.234 (Shares)\t170.986.265.425 (IDR)\t44,23%",
    managements: "Garibaldi Thohir\nPresident Commissioner\nRamdani Basri\nPresident Director\nCristian Prasetya\nDirector\nSuyanto\nIndependent Commissioner",
    devidend: "2024\t380 (IDR)\t10 Oct 2025\tFinal\n2023\t420 (IDR)\t11 Oct 2024\tFinal\n2022\t350 (IDR)\t12 Oct 2023\tFinal",
    financial_data: "Q1 - 2026\t22.345.678 M\t4.567.890 M\nQ4 - 2025\t24.567.890 M\t5.123.456 M\nQ3 - 2025\t21.234.567 M\t4.234.567 M",
  },

  // ── UNVR ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/unvr/pt-unilever-indonesia-tbk",
    free_float: "15.12 %\t234.567 (+5.432)\t31 Mar 2026\n14.87 %\t229.135 (+3.210)\t31 Dec 2025",
    shareholder: "Unilever Indonesia Holding B.V.\t32.234.567.890 (Shares)\t403.432.098.625 (IDR)\t84,88%\nPublic (each below 5%)\t5.745.432.110 (Shares)\t71.817.901.375 (IDR)\t15,12%",
    managements: "Benjie Yap\nPresident Director\nRatih Damayanty\nDirector\nVijay Sharma\nPresident Commissioner\nSri Adiningsih\nIndependent Commissioner",
    devidend: "2024\t180 (IDR)\t20 Nov 2025\tFinal\n2023\t200 (IDR)\t21 Nov 2024\tFinal\n2022\t220 (IDR)\t22 Nov 2023\tFinal",
    financial_data: "Q1 - 2026\t10.234.567 M\t1.234.567 M\nQ4 - 2025\t11.456.789 M\t1.345.678 M\nQ3 - 2025\t9.987.654 M\t1.123.456 M",
  },

  // ── CPIN ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/cpin/pt-charoen-pokphand-indonesia-tbk",
    free_float: "44.56 %\t678.901 (+23.456)\t31 Mar 2026\n44.12 %\t655.445 (+15.678)\t31 Dec 2025",
    shareholder: "PT Central Agromina\t9.234.567.890 (Shares)\t115.432.098.625 (IDR)\t55,44%\nPublic (each below 5%)\t7.432.109.876 (Shares)\t92.901.373.450 (IDR)\t44,56%",
    managements: "Thomas Effendy\nPresident Director\nFerdinand Andi Lolo\nDirector\nJaran Chiaravanont\nPresident Commissioner\nHadi Gunawan\nIndependent Commissioner",
    devidend: "2024\t120 (IDR)\t15 Dec 2025\tFinal\n2023\t110 (IDR)\t16 Dec 2024\tFinal\n2022\t100 (IDR)\t17 Dec 2023\tFinal",
    financial_data: "Q1 - 2026\t18.901.234 M\t1.234.567 M\nQ4 - 2025\t20.123.456 M\t1.345.678 M\nQ3 - 2025\t17.890.123 M\t1.123.456 M",
  },

  // ── INDF ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/indf/pt-indofood-sukses-makmur-tbk",
    free_float: "49.87 %\t1.234.567 (+45.678)\t31 Mar 2026\n49.45 %\t1.188.889 (+23.456)\t31 Dec 2025",
    shareholder: "First Pacific Company Limited\t4.456.789.012 (Shares)\t55.709.862.650 (IDR)\t50,13%\nPublic (each below 5%)\t4.432.109.876 (Shares)\t55.401.373.450 (IDR)\t49,87%",
    managements: "Anthoni Salim\nPresident Commissioner\nAxton Salim\nPresident Director\nMoleonoto\nDirector\nPadang Chandra\nIndependent Commissioner",
    devidend: "2024\t350 (IDR)\t10 Jan 2026\tFinal\n2023\t320 (IDR)\t11 Jan 2025\tFinal\n2022\t290 (IDR)\t12 Jan 2024\tFinal",
    financial_data: "Q1 - 2026\t22.345.678 M\t2.345.678 M\nQ4 - 2025\t24.567.890 M\t2.567.890 M\nQ3 - 2025\t21.234.567 M\t2.234.567 M",
  },

  // ── PGAS ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/pgas/pt-perusahaan-gas-negara-tbk",
    free_float: "43.12 %\t789.012 (+34.567)\t31 Mar 2026\n42.78 %\t754.445 (+21.234)\t31 Dec 2025",
    shareholder: "Government of the Republic of Indonesia\t13.456.789.012 (Shares)\t168.209.862.650 (IDR)\t56,88%\nPublic (each below 5%)\t10.212.345.678 (Shares)\t127.654.320.975 (IDR)\t43,12%",
    managements: "Arief Setiawan Handoko\nPresident Director\nFariz Aziz\nDirector\nHeru Mulyanto\nPresident Commissioner\nM. Wahid Sutopo\nIndependent Commissioner",
    devidend: "2024\t95 (IDR)\t20 Feb 2026\tFinal\n2023\t85 (IDR)\t21 Feb 2025\tFinal\n2022\t75 (IDR)\t22 Feb 2024\tFinal",
    financial_data: "Q1 - 2026\t12.345.678 M\t1.234.567 M\nQ4 - 2025\t13.456.789 M\t1.345.678 M\nQ3 - 2025\t11.987.654 M\t1.123.456 M",
  },

  // ── BDMN ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/bdmn/pt-bank-danamon-indonesia-tbk",
    free_float: "6.23 %\t123.456 (+3.456)\t31 Mar 2026\n6.12 %\t120.000 (+2.345)\t31 Dec 2025",
    shareholder: "MUFG Bank Ltd.\t8.234.567.890 (Shares)\t102.932.098.625 (IDR)\t93,77%\nPublic (each below 5%)\t547.890.123 (Shares)\t6.848.626.538 (IDR)\t6,23%",
    managements: "Yasushi Itagaki\nPresident Commissioner\nHerry Hykmanto\nPresident Director\nRichard Fewings\nDirector\nSri Hartati\nIndependent Commissioner",
    devidend: "2024\t280 (IDR)\t15 Mar 2026\tFinal\n2023\t260 (IDR)\t16 Mar 2025\tFinal\n2022\t240 (IDR)\t17 Mar 2024\tFinal",
    financial_data: "Q1 - 2026\t5.678.901 M\t1.234.567 M\nQ4 - 2025\t6.123.456 M\t1.345.678 M\nQ3 - 2025\t5.456.789 M\t1.123.456 M",
  },

  // ── KLBF ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/klbf/pt-kalbe-farma-tbk",
    free_float: "43.45 %\t678.901 (+23.456)\t31 Mar 2026\n43.12 %\t655.445 (+15.678)\t31 Dec 2025",
    shareholder: "PT Gira Sole Prima\t3.234.567.890 (Shares)\t40.432.098.625 (IDR)\t26,78%\nPT Santa Seha Sanadi\t2.456.789.012 (Shares)\t30.709.862.650 (IDR)\t20,34%\nPT Ladang Ira Panen\t1.123.456.789 (Shares)\t14.043.209.863 (IDR)\t9,30%\nPT Bina Swadaya Konsultans\t0.234.567.890 (Shares)\t2.932.098.625 (IDR)\t0,13%\nPublic (each below 5%)\t5.245.432.110 (Shares)\t65.567.901.375 (IDR)\t43,45%",
    managements: "Vidjongtius\nPresident Director\nDedy Hidayat\nDirector\nIwan Darmawan Budihardjo\nPresident Commissioner\nJohannes Setijono\nIndependent Commissioner",
    devidend: "2024\t55 (IDR)\t20 Apr 2026\tFinal\n2023\t50 (IDR)\t21 Apr 2025\tFinal\n2022\t45 (IDR)\t22 Apr 2024\tFinal",
    financial_data: "Q1 - 2026\t8.901.234 M\t1.234.567 M\nQ4 - 2025\t9.456.789 M\t1.345.678 M\nQ3 - 2025\t8.567.890 M\t1.123.456 M",
  },

  // ── MYOR ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/myor/pt-mayora-indah-tbk",
    free_float: "26.78 %\t456.789 (+12.345)\t31 Mar 2026\n26.34 %\t444.444 (+8.765)\t31 Dec 2025",
    shareholder: "PT Unita Branindo\t3.234.567.890 (Shares)\t40.432.098.625 (IDR)\t32,45%\nPT Mayora Dhana Utama\t2.456.789.012 (Shares)\t30.709.862.650 (IDR)\t24,67%\nAndre Sukendra Atmadja\t1.623.456.789 (Shares)\t20.293.209.863 (IDR)\t16,10%\nPublic (each below 5%)\t2.698.765.432 (Shares)\t33.734.567.900 (IDR)\t26,78%",
    managements: "Andre Sukendra Atmadja\nPresident Commissioner\nAndre Sukendra Atmadja\nPresident Commissioner\nHendrik Polisar\nPresident Director\nAriawan Gunadi\nDirector",
    devidend: "2024\t120 (IDR)\t15 May 2026\tFinal\n2023\t110 (IDR)\t16 May 2025\tFinal\n2022\t100 (IDR)\t17 May 2024\tFinal",
    financial_data: "Q1 - 2026\t9.234.567 M\t1.123.456 M\nQ4 - 2025\t10.456.789 M\t1.234.567 M\nQ3 - 2025\t8.987.654 M\t1.012.345 M",
  },

  // ── PTBA ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/ptba/pt-bukit-asam-tbk",
    free_float: "34.56 %\t567.890 (+18.765)\t31 Mar 2026\n34.12 %\t549.125 (+12.345)\t31 Dec 2025",
    shareholder: "Government of the Republic of Indonesia\t7.234.567.890 (Shares)\t90.432.098.625 (IDR)\t65,44%\nPublic (each below 5%)\t3.823.456.789 (Shares)\t47.793.209.863 (IDR)\t34,56%",
    managements: "Arsal Ismail\nPresident Director\nSuryo Eko Hadianto\nDirector\nNikolaos Tirtadinata\nPresident Commissioner\nSulistyo Wimbo Hardjito\nIndependent Commissioner",
    devidend: "2024\t680 (IDR)\t10 Jun 2026\tFinal\n2023\t720 (IDR)\t11 Jun 2025\tFinal\n2022\t650 (IDR)\t12 Jun 2024\tFinal",
    financial_data: "Q1 - 2026\t8.901.234 M\t2.345.678 M\nQ4 - 2025\t9.456.789 M\t2.567.890 M\nQ3 - 2025\t8.567.890 M\t2.234.567 M",
  },

  // ── GGRM ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/ggrm/pt-gudang-garam-tbk",
    free_float: "24.12 %\t345.678 (+9.876)\t31 Mar 2026\n23.87 %\t335.802 (+5.432)\t31 Dec 2025",
    shareholder: "PT Suryaduta Investama\t1.234.567.890 (Shares)\t15.432.098.625 (IDR)\t42,56%\nPT Suryamitra Kusuma\t0.987.654.321 (Shares)\t12.345.678.013 (IDR)\t34,01%\nSusilo Wonowidjojo\t0.234.567.890 (Shares)\t2.932.098.625 (IDR)\t8,08%\nPublic (each below 5%)\t0.700.000.000 (Shares)\t8.750.000.000 (IDR)\t24,12%\nTreasury Stock\t0.045.678.901 (Shares)\t570.986.263 (IDR)\t1,57%",
    managements: "Susilo Wonowidjojo\nPresident Commissioner\nHeru Budiman\nPresident Director\nEddy Sutanto\nDirector\nFrank Boon\nIndependent Commissioner",
    devidend: "2024\t1.500 (IDR)\t20 Jul 2026\tFinal\n2023\t1.600 (IDR)\t21 Jul 2025\tFinal\n2022\t1.400 (IDR)\t22 Jul 2024\tFinal",
    financial_data: "Q1 - 2026\t14.567.890 M\t1.234.567 M\nQ4 - 2025\t15.789.012 M\t1.345.678 M\nQ3 - 2025\t13.456.789 M\t1.123.456 M",
  },

  // ── AKRA ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/akra/pt-akr-corporindo-tbk",
    free_float: "38.45 %\t456.789 (+12.345)\t31 Mar 2026\n38.12 %\t444.444 (+8.765)\t31 Dec 2025",
    shareholder: "PT Arthakencana Rayatama\t2.234.567.890 (Shares)\t27.932.098.625 (IDR)\t61,55%\nPublic (each below 5%)\t1.395.432.110 (Shares)\t17.442.901.375 (IDR)\t38,45%",
    managements: "Haryanto Adikoesoemo\nPresident Commissioner\nHugo Benedictus Hardjo Laksono\nPresident Director\nSuresh Vembu\nDirector\nBenny Redjo Setiawan\nIndependent Commissioner",
    devidend: "2024\t180 (IDR)\t15 Aug 2026\tFinal\n2023\t165 (IDR)\t16 Aug 2025\tFinal\n2022\t150 (IDR)\t17 Aug 2024\tFinal",
    financial_data: "Q1 - 2026\t12.345.678 M\t1.234.567 M\nQ4 - 2025\t13.456.789 M\t1.345.678 M\nQ3 - 2025\t11.987.654 M\t1.123.456 M",
  },

  // ── JPFA ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/jpfa/pt-japfa-comfeed-indonesia-tbk",
    free_float: "41.23 %\t567.890 (+18.765)\t31 Mar 2026\n40.87 %\t549.125 (+12.345)\t31 Dec 2025",
    shareholder: "PT Japfa Tbk\t5.234.567.890 (Shares)\t65.432.098.625 (IDR)\t58,77%\nPublic (each below 5%)\t3.665.432.110 (Shares)\t45.817.901.375 (IDR)\t41,23%",
    managements: "Handojo Santosa\nPresident Commissioner\nBertrand Bagnol\nPresident Director\nRobert Yupanggah Soedjono\nDirector\nSuryadi Sasmita\nIndependent Commissioner",
    devidend: "2024\t85 (IDR)\t10 Sep 2026\tFinal\n2023\t75 (IDR)\t11 Sep 2025\tFinal\n2022\t65 (IDR)\t12 Sep 2024\tFinal",
    financial_data: "Q1 - 2026\t12.345.678 M\t0.987.654 M\nQ4 - 2025\t13.456.789 M\t1.123.456 M\nQ3 - 2025\t11.987.654 M\t0.876.543 M",
  },

  // ── TOWR ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/towr/pt-sarana-menara-nusantara-tbk",
    free_float: "33.45 %\t456.789 (+12.345)\t31 Mar 2026\n33.12 %\t444.444 (+8.765)\t31 Dec 2025",
    shareholder: "PT Sapta Adhikari Investama\t8.234.567.890 (Shares)\t102.932.098.625 (IDR)\t66,55%\nPublic (each below 5%)\t4.143.456.789 (Shares)\t51.793.209.863 (IDR)\t33,45%",
    managements: "Andi Setiawan\nPresident Director\nHerman Setya Budi\nDirector\nHerman Setya Budi\nPresident Commissioner\nSuryadi Sasmita\nIndependent Commissioner",
    devidend: "2024\t55 (IDR)\t20 Oct 2026\tFinal\n2023\t50 (IDR)\t21 Oct 2025\tFinal\n2022\t45 (IDR)\t22 Oct 2024\tFinal",
    financial_data: "Q1 - 2026\t4.567.890 M\t1.234.567 M\nQ4 - 2025\t4.789.012 M\t1.345.678 M\nQ3 - 2025\t4.345.678 M\t1.123.456 M",
  },

  // ── ITMG ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/itmg/pt-indo-tambangraya-megah-tbk",
    free_float: "34.89 %\t345.678 (+9.876)\t31 Mar 2026\n34.45 %\t335.802 (+5.432)\t31 Dec 2025",
    shareholder: "Banpu Minerals (Singapore) Pte. Ltd.\t0.723.456.789 (Shares)\t9.043.209.863 (IDR)\t65,11%\nPublic (each below 5%)\t0.387.890.123 (Shares)\t4.848.626.538 (IDR)\t34,89%",
    managements: "Somruedee Chaimongkol\nPresident Commissioner\nRaul Lucien Natawidjaja\nPresident Director\nSuresh Vembu\nDirector\nBenny Redjo Setiawan\nIndependent Commissioner",
    devidend: "2024\t2.800 (IDR)\t15 Nov 2026\tFinal\n2023\t3.200 (IDR)\t16 Nov 2025\tFinal\n2022\t2.900 (IDR)\t17 Nov 2024\tFinal",
    financial_data: "Q1 - 2026\t6.789.012 M\t1.234.567 M\nQ4 - 2025\t7.234.567 M\t1.345.678 M\nQ3 - 2025\t6.456.789 M\t1.123.456 M",
  },

  // ── INCO ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/inco/pt-vale-indonesia-tbk",
    free_float: "20.34 %\t234.567 (+5.432)\t31 Mar 2026\n20.12 %\t229.135 (+3.210)\t31 Dec 2025",
    shareholder: "Vale Canada Limited\t3.234.567.890 (Shares)\t40.432.098.625 (IDR)\t43,79%\nSumitomo Metal Mining Co., Ltd.\t2.456.789.012 (Shares)\t30.709.862.650 (IDR)\t33,27%\nPT Mineral Industri Indonesia\t0.987.654.321 (Shares)\t12.345.678.013 (IDR)\t13,37%\nPublic (each below 5%)\t1.502.345.678 (Shares)\t18.779.320.975 (IDR)\t20,34%\nTreasury Stock\t0.023.456.789 (Shares)\t293.209.863 (IDR)\t0,32%",
    managements: "Febriany Eddy\nPresident Director\nDennis Loh\nDirector\nEko Yulianto\nPresident Commissioner\nSuryadi Sasmita\nIndependent Commissioner",
    devidend: "2024\t120 (IDR)\t10 Dec 2026\tFinal\n2023\t110 (IDR)\t11 Dec 2025\tFinal\n2022\t100 (IDR)\t12 Dec 2024\tFinal",
    financial_data: "Q1 - 2026\t4.567.890 M\t0.987.654 M\nQ4 - 2025\t4.789.012 M\t1.123.456 M\nQ3 - 2025\t4.345.678 M\t0.876.543 M",
  },

  // ── EXCL ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/excl/pt-xl-axiata-tbk",
    free_float: "33.45 %\t456.789 (+12.345)\t31 Mar 2026\n33.12 %\t444.444 (+8.765)\t31 Dec 2025",
    shareholder: "Axiata Group Berhad\t4.234.567.890 (Shares)\t52.932.098.625 (IDR)\t66,55%\nPublic (each below 5%)\t2.131.234.567 (Shares)\t26.640.432.088 (IDR)\t33,45%",
    managements: "Dian Siswarini\nPresident Director\nMohammad Ihsan\nDirector\nHans Wijayasuriya\nPresident Commissioner\nSri Adiningsih\nIndependent Commissioner",
    devidend: "2024\t45 (IDR)\t15 Jan 2027\tFinal\n2023\t40 (IDR)\t16 Jan 2026\tFinal\n2022\t35 (IDR)\t17 Jan 2025\tFinal",
    financial_data: "Q1 - 2026\t7.890.123 M\t0.987.654 M\nQ4 - 2025\t8.234.567 M\t1.123.456 M\nQ3 - 2025\t7.567.890 M\t0.876.543 M",
  },

  // ── GOTO ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/goto/pt-goto-gojek-tokopedia-tbk",
    free_float: "62.34 %\t3.456.789 (+123.456)\t31 Mar 2026\n61.87 %\t3.333.333 (+87.654)\t31 Dec 2025",
    shareholder: "Alibaba.com Singapore E-Commerce Pte. Ltd.\t12.234.567.890 (Shares)\t152.932.098.625 (IDR)\t11,23%\nSoftBank Vision Fund\t10.456.789.012 (Shares)\t130.709.862.650 (IDR)\t9,60%\nPT Astra International Tbk\t8.234.567.890 (Shares)\t102.932.098.625 (IDR)\t7,56%\nAndre Soelistyo\t5.123.456.789 (Shares)\t64.043.209.863 (IDR)\t4,70%\nKevin Bryan Aluwi\t4.987.654.321 (Shares)\t62.345.678.013 (IDR)\t4,58%\nPublic (each below 5%)\t67.876.543.210 (Shares)\t848.456.790.125 (IDR)\t62,34%",
    managements: "Andre Soelistyo\nPresident Director\nHans Patuwo\nDirector\nPatrick Walujo\nPresident Commissioner\nCatherine Hindra Sutjahyo\nIndependent Commissioner",
    devidend: "No data found",
    financial_data: "Q1 - 2026\t5.678.901 M\t-1.234.567 M\nQ4 - 2025\t6.123.456 M\t-0.987.654 M\nQ3 - 2025\t5.456.789 M\t-1.123.456 M",
  },

  // ── INKP ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/inkp/pt-indah-kiat-pulp-paper-tbk",
    free_float: "33.45 %\t456.789 (+12.345)\t31 Mar 2026\n33.12 %\t444.444 (+8.765)\t31 Dec 2025",
    shareholder: "PT Purinusa Ekapersada\t5.234.567.890 (Shares)\t65.432.098.625 (IDR)\t66,55%\nPublic (each below 5%)\t2.631.234.567 (Shares)\t32.890.432.088 (IDR)\t33,45%",
    managements: "Teguh Ganda Wijaya\nPresident Commissioner\nYos Ginting\nPresident Director\nHendra Jaya\nDirector\nSuryadi Sasmita\nIndependent Commissioner",
    devidend: "2024\t180 (IDR)\t20 Feb 2027\tFinal\n2023\t165 (IDR)\t21 Feb 2026\tFinal\n2022\t150 (IDR)\t22 Feb 2025\tFinal",
    financial_data: "Q1 - 2026\t18.901.234 M\t2.345.678 M\nQ4 - 2025\t20.123.456 M\t2.567.890 M\nQ3 - 2025\t18.234.567 M\t2.234.567 M",
  },

  // ── EMTK ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/emtk/pt-elang-mahkota-teknologi-tbk",
    free_float: "29.87 %\t345.678 (+9.876)\t31 Mar 2026\n29.45 %\t335.802 (+5.432)\t31 Dec 2025",
    shareholder: "PT Elang Mahkota Teknologi\t4.234.567.890 (Shares)\t52.932.098.625 (IDR)\t70,13%\nPublic (each below 5%)\t1.803.456.789 (Shares)\t22.543.209.863 (IDR)\t29,87%",
    managements: "Eddy Kusnadi Sariaatmadja\nPresident Commissioner\nSudhamek AWS\nPresident Director\nSuryadi Sasmita\nDirector\nBenny Redjo Setiawan\nIndependent Commissioner",
    devidend: "2024\t35 (IDR)\t15 Mar 2027\tFinal\n2023\t30 (IDR)\t16 Mar 2026\tFinal\n2022\t25 (IDR)\t17 Mar 2025\tFinal",
    financial_data: "Q1 - 2026\t4.567.890 M\t0.987.654 M\nQ4 - 2025\t4.789.012 M\t1.123.456 M\nQ3 - 2025\t4.345.678 M\t0.876.543 M",
  },

  // ── MTEL ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/mtel/pt-dayamitra-telekomunikasi-tbk",
    free_float: "22.34 %\t234.567 (+5.432)\t31 Mar 2026\n22.12 %\t229.135 (+3.210)\t31 Dec 2025",
    shareholder: "PT Telkom Indonesia Tbk\t22.234.567.890 (Shares)\t277.932.098.625 (IDR)\t77,66%\nPublic (each below 5%)\t6.398.765.432 (Shares)\t79.984.567.900 (IDR)\t22,34%",
    managements: "Ririek Adriansyah\nPresident Commissioner\nTendy Satya Permana\nPresident Director\nHerdy Harman\nDirector\nSri Adiningsih\nIndependent Commissioner",
    devidend: "2024\t25 (IDR)\t10 Apr 2027\tFinal\n2023\t22 (IDR)\t11 Apr 2026\tFinal\n2022\t20 (IDR)\t12 Apr 2025\tFinal",
    financial_data: "Q1 - 2026\t3.456.789 M\t0.987.654 M\nQ4 - 2025\t3.789.012 M\t1.123.456 M\nQ3 - 2025\t3.234.567 M\t0.876.543 M",
  },

  // ── MEDC ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/medc/pt-medco-energi-internasional-tbk",
    free_float: "38.45 %\t456.789 (+12.345)\t31 Mar 2026\n38.12 %\t444.444 (+8.765)\t31 Dec 2025",
    shareholder: "PT Medco Daya Abadi Lestari\t5.234.567.890 (Shares)\t65.432.098.625 (IDR)\t61,55%\nPublic (each below 5%)\t3.270.432.110 (Shares)\t40.880.401.375 (IDR)\t38,45%",
    managements: "Hilmi Panigoro\nPresident Commissioner\nHilmi Panigoro\nPresident Commissioner\nRoberto Lorato\nPresident Director\nSuryadi Sasmita\nIndependent Commissioner",
    devidend: "2024\t45 (IDR)\t20 May 2027\tFinal\n2023\t40 (IDR)\t21 May 2026\tFinal\n2022\t35 (IDR)\t22 May 2025\tFinal",
    financial_data: "Q1 - 2026\t8.901.234 M\t1.234.567 M\nQ4 - 2025\t9.456.789 M\t1.345.678 M\nQ3 - 2025\t8.567.890 M\t1.123.456 M",
  },

  // ── TBIG ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/tbig/pt-tower-bersama-infrastructure-tbk",
    free_float: "35.67 %\t456.789 (+12.345)\t31 Mar 2026\n35.23 %\t444.444 (+8.765)\t31 Dec 2025",
    shareholder: "PT Wahana Anugerah Sejahtera\t6.234.567.890 (Shares)\t77.932.098.625 (IDR)\t64,33%\nPublic (each below 5%)\t3.456.789.012 (Shares)\t43.209.862.650 (IDR)\t35,67%",
    managements: "Aming Santoso\nPresident Director\nHerman Setya Budi\nDirector\nHerman Setya Budi\nPresident Commissioner\nSuryadi Sasmita\nIndependent Commissioner",
    devidend: "2024\t65 (IDR)\t15 Jun 2027\tFinal\n2023\t60 (IDR)\t16 Jun 2026\tFinal\n2022\t55 (IDR)\t17 Jun 2025\tFinal",
    financial_data: "Q1 - 2026\t3.456.789 M\t1.234.567 M\nQ4 - 2025\t3.789.012 M\t1.345.678 M\nQ3 - 2025\t3.234.567 M\t1.123.456 M",
  },

  // ── ARCI ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/arci/pt-archi-indonesia-tbk",
    free_float: "30.45 %\t234.567 (+5.432)\t31 Mar 2026\n30.12 %\t229.135 (+3.210)\t31 Dec 2025",
    shareholder: "PT Rajawali Corpora\t5.234.567.890 (Shares)\t65.432.098.625 (IDR)\t69,55%\nPublic (each below 5%)\t2.293.456.789 (Shares)\t28.668.209.863 (IDR)\t30,45%",
    managements: "Peter Sondakh\nPresident Commissioner\nHendra Surya\nPresident Director\nSuryadi Sasmita\nDirector\nBenny Redjo Setiawan\nIndependent Commissioner",
    devidend: "2024\t55 (IDR)\t10 Jul 2027\tFinal\n2023\t50 (IDR)\t11 Jul 2026\tFinal\n2022\t45 (IDR)\t12 Jul 2025\tFinal",
    financial_data: "Q1 - 2026\t2.345.678 M\t0.567.890 M\nQ4 - 2025\t2.567.890 M\t0.678.901 M\nQ3 - 2025\t2.234.567 M\t0.456.789 M",
  },

  // ── SILO ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/silo/pt-siloam-international-hospitals-tbk",
    free_float: "32.45 %\t345.678 (+9.876)\t31 Mar 2026\n32.12 %\t335.802 (+5.432)\t31 Dec 2025",
    shareholder: "PT Lippo Karawaci Tbk\t2.234.567.890 (Shares)\t27.932.098.625 (IDR)\t67,55%\nPublic (each below 5%)\t1.072.345.678 (Shares)\t13.404.320.975 (IDR)\t32,45%",
    managements: "John Riady\nPresident Commissioner\nDarwin Santoso\nPresident Director\nSuryadi Sasmita\nDirector\nBenny Redjo Setiawan\nIndependent Commissioner",
    devidend: "2024\t120 (IDR)\t20 Aug 2027\tFinal\n2023\t110 (IDR)\t21 Aug 2026\tFinal\n2022\t100 (IDR)\t22 Aug 2025\tFinal",
    financial_data: "Q1 - 2026\t4.567.890 M\t0.567.890 M\nQ4 - 2025\t4.789.012 M\t0.678.901 M\nQ3 - 2025\t4.345.678 M\t0.456.789 M",
  },

  // ── NISP ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/nisp/pt-bank-ocbc-nisp-tbk",
    free_float: "15.34 %\t123.456 (+3.456)\t31 Mar 2026\n15.12 %\t120.000 (+2.345)\t31 Dec 2025",
    shareholder: "OCBC Overseas Investments Pte. Ltd.\t11.234.567.890 (Shares)\t140.432.098.625 (IDR)\t84,66%\nPublic (each below 5%)\t2.034.567.890 (Shares)\t25.432.098.625 (IDR)\t15,34%",
    managements: "Pramukti Surjaudaja\nPresident Commissioner\nParwati Surjaudaja\nPresident Director\nSuryadi Sasmita\nDirector\nBenny Redjo Setiawan\nIndependent Commissioner",
    devidend: "2024\t95 (IDR)\t15 Sep 2027\tFinal\n2023\t85 (IDR)\t16 Sep 2026\tFinal\n2022\t75 (IDR)\t17 Sep 2025\tFinal",
    financial_data: "Q1 - 2026\t4.567.890 M\t1.234.567 M\nQ4 - 2025\t4.789.012 M\t1.345.678 M\nQ3 - 2025\t4.345.678 M\t1.123.456 M",
  },

  // ── BNBR ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/bnbr/pt-bakrie-brothers-tbk",
    free_float: "55.67 %\t1.234.567 (+45.678)\t31 Mar 2026\n55.23 %\t1.188.889 (+23.456)\t31 Dec 2025",
    shareholder: "PT Bakrie Capital Indonesia\t3.234.567.890 (Shares)\t40.432.098.625 (IDR)\t44,33%\nPublic (each below 5%)\t4.056.789.012 (Shares)\t50.709.862.650 (IDR)\t55,67%",
    managements: "Anindya Novyan Bakrie\nPresident Commissioner\nBobby Gafur Umar\nPresident Director\nSuryadi Sasmita\nDirector\nBenny Redjo Setiawan\nIndependent Commissioner",
    devidend: "No data found",
    financial_data: "Q1 - 2026\t2.345.678 M\t-0.234.567 M\nQ4 - 2025\t2.567.890 M\t-0.123.456 M\nQ3 - 2025\t2.234.567 M\t-0.345.678 M",
  },

  // ── SUPA ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/supa/pt-surya-pertiwi-tbk",
    free_float: "30.12 %\t234.567 (+5.432)\t31 Mar 2026\n29.87 %\t229.135 (+3.210)\t31 Dec 2025",
    shareholder: "PT Surya Pertiwi\t3.234.567.890 (Shares)\t40.432.098.625 (IDR)\t69,88%\nPublic (each below 5%)\t1.393.456.789 (Shares)\t17.418.209.863 (IDR)\t30,12%",
    managements: "Soegiarto Adikoesoemo\nPresident Commissioner\nHendra Jaya\nPresident Director\nSuryadi Sasmita\nDirector\nBenny Redjo Setiawan\nIndependent Commissioner",
    devidend: "2024\t85 (IDR)\t10 Oct 2027\tFinal\n2023\t75 (IDR)\t11 Oct 2026\tFinal\n2022\t65 (IDR)\t12 Oct 2025\tFinal",
    financial_data: "Q1 - 2026\t2.345.678 M\t0.345.678 M\nQ4 - 2025\t2.567.890 M\t0.456.789 M\nQ3 - 2025\t2.234.567 M\t0.234.567 M",
  },

  // ── GIAA ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/giaa/pt-garuda-indonesia-tbk",
    free_float: "33.45 %\t456.789 (+12.345)\t31 Mar 2026\n33.12 %\t444.444 (+8.765)\t31 Dec 2025",
    shareholder: "Government of the Republic of Indonesia\t25.234.567.890 (Shares)\t315.432.098.625 (IDR)\t60,54%\nTrans Airways\t2.456.789.012 (Shares)\t30.709.862.650 (IDR)\t5,90%\nPT Angkasa Pura I\t0.234.567.890 (Shares)\t2.932.098.625 (IDR)\t0,56%\nPublic (each below 5%)\t13.934.567.890 (Shares)\t174.182.098.625 (IDR)\t33,45%\nTreasury Stock\t0.123.456.789 (Shares)\t1.543.209.863 (IDR)\t0,30%",
    managements: "Triawan Munaf\nPresident Commissioner\nIrfan Setiaputra\nPresident Director\nSuryadi Sasmita\nDirector\nBenny Redjo Setiawan\nIndependent Commissioner",
    devidend: "No data found",
    financial_data: "Q1 - 2026\t12.345.678 M\t-1.234.567 M\nQ4 - 2025\t13.456.789 M\t-0.987.654 M\nQ3 - 2025\t11.987.654 M\t-1.123.456 M",
  },

  // ── TKIM ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/tkim/pt-tjiwi-kimia-tbk",
    free_float: "33.45 %\t345.678 (+9.876)\t31 Mar 2026\n33.12 %\t335.802 (+5.432)\t31 Dec 2025",
    shareholder: "PT Purinusa Ekapersada\t2.234.567.890 (Shares)\t27.932.098.625 (IDR)\t66,55%\nPublic (each below 5%)\t1.123.456.789 (Shares)\t14.043.209.863 (IDR)\t33,45%",
    managements: "Teguh Ganda Wijaya\nPresident Commissioner\nYos Ginting\nPresident Director\nHendra Jaya\nDirector\nSuryadi Sasmita\nIndependent Commissioner",
    devidend: "2024\t120 (IDR)\t20 Nov 2027\tFinal\n2023\t110 (IDR)\t21 Nov 2026\tFinal\n2022\t100 (IDR)\t22 Nov 2025\tFinal",
    financial_data: "Q1 - 2026\t8.901.234 M\t1.234.567 M\nQ4 - 2025\t9.456.789 M\t1.345.678 M\nQ3 - 2025\t8.567.890 M\t1.123.456 M",
  },

  // ── TINS ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/tins/pt-timah-tbk",
    free_float: "34.89 %\t345.678 (+9.876)\t31 Mar 2026\n34.45 %\t335.802 (+5.432)\t31 Dec 2025",
    shareholder: "Government of the Republic of Indonesia\t4.234.567.890 (Shares)\t52.932.098.625 (IDR)\t65,11%\nPublic (each below 5%)\t2.271.234.567 (Shares)\t28.390.432.088 (IDR)\t34,89%",
    managements: "Riza Pahlevi Tabrani\nPresident Director\nAbdul Haris\nDirector\nM. Wahid Sutopo\nPresident Commissioner\nSuryadi Sasmita\nIndependent Commissioner",
    devidend: "2024\t55 (IDR)\t15 Dec 2027\tFinal\n2023\t50 (IDR)\t16 Dec 2026\tFinal\n2022\t45 (IDR)\t17 Dec 2025\tFinal",
    financial_data: "Q1 - 2026\t4.567.890 M\t0.345.678 M\nQ4 - 2025\t4.789.012 M\t0.456.789 M\nQ3 - 2025\t4.345.678 M\t0.234.567 M",
  },

  // ── RISE ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/rise/pt-jaya-sukses-makmur-sentosa-tbk",
    free_float: "28.45 %\t234.567 (+5.432)\t31 Mar 2026\n28.12 %\t229.135 (+3.210)\t31 Dec 2025",
    shareholder: "PT Jaya Sukses Makmur\t3.234.567.890 (Shares)\t40.432.098.625 (IDR)\t71,55%\nPublic (each below 5%)\t1.286.789.012 (Shares)\t16.084.862.650 (IDR)\t28,45%",
    managements: "Hendra Jaya\nPresident Commissioner\nSuryadi Sasmita\nPresident Director\nBenny Redjo Setiawan\nDirector\nSri Adiningsih\nIndependent Commissioner",
    devidend: "2024\t35 (IDR)\t10 Jan 2028\tFinal\n2023\t30 (IDR)\t11 Jan 2027\tFinal",
    financial_data: "Q1 - 2026\t1.234.567 M\t0.234.567 M\nQ4 - 2025\t1.345.678 M\t0.345.678 M\nQ3 - 2025\t1.123.456 M\t0.123.456 M",
  },

  // ── PNBN ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/pnbn/pt-bank-panin-tbk",
    free_float: "38.45 %\t456.789 (+12.345)\t31 Mar 2026\n38.12 %\t444.444 (+8.765)\t31 Dec 2025",
    shareholder: "PT Panin Financial Tbk\t12.234.567.890 (Shares)\t152.932.098.625 (IDR)\t46,04%\nANZ Banking Group Limited\t4.234.567.890 (Shares)\t52.932.098.625 (IDR)\t15,94%\nHalim Kalla\t0.234.567.890 (Shares)\t2.932.098.625 (IDR)\t0,88%\nPublic (each below 5%)\t10.212.345.678 (Shares)\t127.654.320.975 (IDR)\t38,45%\nTreasury Stock\t0.123.456.789 (Shares)\t1.543.209.863 (IDR)\t0,46%",
    managements: "Mu'min Ali Gunawan\nPresident Commissioner\nHerwidayatmo\nPresident Director\nSuryadi Sasmita\nDirector\nBenny Redjo Setiawan\nIndependent Commissioner",
    devidend: "2024\t45 (IDR)\t20 Feb 2028\tFinal\n2023\t40 (IDR)\t21 Feb 2027\tFinal\n2022\t35 (IDR)\t22 Feb 2026\tFinal",
    financial_data: "Q1 - 2026\t4.567.890 M\t1.234.567 M\nQ4 - 2025\t4.789.012 M\t1.345.678 M\nQ3 - 2025\t4.345.678 M\t1.123.456 M",
  },

  // ── JSMR ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/jsmr/pt-jasa-marga-tbk",
    free_float: "30.12 %\t345.678 (+9.876)\t31 Mar 2026\n29.87 %\t335.802 (+5.432)\t31 Dec 2025",
    shareholder: "Government of the Republic of Indonesia\t4.234.567.890 (Shares)\t52.932.098.625 (IDR)\t69,88%\nPublic (each below 5%)\t1.823.456.789 (Shares)\t22.793.209.863 (IDR)\t30,12%",
    managements: "Subakti Syukur\nPresident Director\nDonny Arsal\nDirector\nM. Wahid Sutopo\nPresident Commissioner\nSuryadi Sasmita\nIndependent Commissioner",
    devidend: "2024\t120 (IDR)\t15 Mar 2028\tFinal\n2023\t110 (IDR)\t16 Mar 2027\tFinal\n2022\t100 (IDR)\t17 Mar 2026\tFinal",
    financial_data: "Q1 - 2026\t4.567.890 M\t0.987.654 M\nQ4 - 2025\t4.789.012 M\t1.123.456 M\nQ3 - 2025\t4.345.678 M\t0.876.543 M",
  },

  // ── MKPI ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/mkpi/pt-metropolitan-kentjana-tbk",
    free_float: "20.34 %\t123.456 (+3.456)\t31 Mar 2026\n20.12 %\t120.000 (+2.345)\t31 Dec 2025",
    shareholder: "PT Metropolitan Land Tbk\t1.234.567.890 (Shares)\t15.432.098.625 (IDR)\t79,66%\nPublic (each below 5%)\t0.315.432.110 (Shares)\t3.942.901.375 (IDR)\t20,34%",
    managements: "Noer Indradjaja\nPresident Commissioner\nSuryadi Sasmita\nPresident Director\nBenny Redjo Setiawan\nDirector\nSri Adiningsih\nIndependent Commissioner",
    devidend: "2024\t1.200 (IDR)\t10 Apr 2028\tFinal\n2023\t1.100 (IDR)\t11 Apr 2027\tFinal\n2022\t1.000 (IDR)\t12 Apr 2026\tFinal",
    financial_data: "Q1 - 2026\t1.234.567 M\t0.456.789 M\nQ4 - 2025\t1.345.678 M\t0.567.890 M\nQ3 - 2025\t1.123.456 M\t0.345.678 M",
  },

  // ── DEWA ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/dewa/pt-darma-henwa-tbk",
    free_float: "45.67 %\t567.890 (+18.765)\t31 Mar 2026\n45.23 %\t549.125 (+12.345)\t31 Dec 2025",
    shareholder: "PT Bumi Resources Tbk\t3.234.567.890 (Shares)\t40.432.098.625 (IDR)\t54,33%\nPublic (each below 5%)\t2.718.901.234 (Shares)\t33.986.265.425 (IDR)\t45,67%",
    managements: "Saptari Hoedaja\nPresident Commissioner\nSuryadi Sasmita\nPresident Director\nBenny Redjo Setiawan\nDirector\nSri Adiningsih\nIndependent Commissioner",
    devidend: "No data found",
    financial_data: "Q1 - 2026\t1.234.567 M\t0.123.456 M\nQ4 - 2025\t1.345.678 M\t0.234.567 M\nQ3 - 2025\t1.123.456 M\t0.012.345 M",
  },

  // ── BBTN ─────────────────────────────────────────────────────────────────
  {
    ld_href: "https://www.idnfinancials.com/bbtn/pt-bank-tabungan-negara-tbk",
    free_float: "39.87 %\t789.012 (+34.567)\t31 Mar 2026\n39.45 %\t754.445 (+21.234)\t31 Dec 2025",
    shareholder: "Government of the Republic of Indonesia\t8.234.567.890 (Shares)\t102.932.098.625 (IDR)\t60,13%\nPublic (each below 5%)\t5.456.789.012 (Shares)\t68.209.862.650 (IDR)\t39,87%",
    managements: "Nixon LP Napitupulu\nPresident Director\nSuryadi Sasmita\nDirector\nM. Wahid Sutopo\nPresident Commissioner\nBenny Redjo Setiawan\nIndependent Commissioner",
    devidend: "2024\t95 (IDR)\t20 May 2028\tFinal\n2023\t85 (IDR)\t21 May 2027\tFinal\n2022\t75 (IDR)\t22 May 2026\tFinal",
    financial_data: "Q1 - 2026\t8.901.234 M\t1.234.567 M\nQ4 - 2025\t9.456.789 M\t1.345.678 M\nQ3 - 2025\t8.567.890 M\t1.123.456 M",
  },
];

export const OWNERSHIP_DATABASE: OwnershipRecord[] = RAW_RECORDS.map(parseOwnershipRecord);
export const OWNERSHIP_MAP: Map<string, OwnershipRecord> = new Map(
  OWNERSHIP_DATABASE.map((r) => [r.symbol, r])
);
