/*
# Seed Motor Data from motor-data.ts

## Overview
Inserts all 22 motor products and their financing plans into the database.
Also seeds the FAQ entries currently hardcoded in the FAQ component.

## What gets seeded
1. **products** — 22 motor models with name, slug, category, OTR, image, popular flag, stock status, sort order
2. **financing_plans** — 3 financing options per motor (66 total) with DP, tenor35, tenor47
3. **faqs** — 11 FAQ entries from the public FAQ section

## Idempotent
All inserts use ON CONFLICT to be safe to re-run.
*/

-- ============ SEED PRODUCTS ============
INSERT INTO products (slug, name, category, otr, image, popular, status, stock_status, stock_quantity, sort_order, description)
VALUES
  ('beat-cbs', 'BeAT CBS', 'Matic', 21270000, 'https://images.pexels.com/photos/2830762/pexels-photo-2830762.jpeg?auto=compress&cs=tinysrgb&w=800', true, 'active', 'ready', 10, 1, NULL),
  ('beat-deluxe', 'BeAT Deluxe', 'Matic', 22070000, 'https://images.pexels.com/photos/2044873/pexels-photo-2044873.jpeg?auto=compress&cs=tinysrgb&w=800', true, 'active', 'ready', 8, 2, NULL),
  ('beat-smart-key', 'BeAT Smart Key', 'Matic', 22670000, 'https://images.pexels.com/photos/2044876/pexels-photo-2044876.jpeg?auto=compress&cs=tinysrgb&w=800', false, 'active', 'ready', 5, 3, NULL),
  ('beat-street', 'BeAT Street (MM1 - MM2)', 'Matic', 21430000, 'https://images.pexels.com/photos/13611191/pexels-photo-13611191.jpeg?auto=compress&cs=tinysrgb&w=800', false, 'active', 'ready', 7, 4, NULL),
  ('beat-street-plus', 'BeAT Street Plus (MM2A)', 'Matic', 22120000, 'https://images.pexels.com/photos/2044868/pexels-photo-2044868.jpeg?auto=compress&cs=tinysrgb&w=800', false, 'active', 'ready', 5, 5, NULL),
  ('scoopy-fashion', 'Scoopy Fashion', 'Matic', 25350000, 'https://images.pexels.com/photos/5027485/pexels-photo-5027485.jpeg?auto=compress&cs=tinysrgb&w=800', true, 'active', 'ready', 10, 6, NULL),
  ('scoopy-prestige', 'Scoopy Prestige / Stylish', 'Matic', 26230000, 'https://images.pexels.com/photos/2830762/pexels-photo-2830762.jpeg?auto=compress&cs=tinysrgb&w=800', true, 'active', 'ready', 6, 7, NULL),
  ('stylo-160-cbs', 'STYLO 160 CBS', 'Sport / Premium Matic', 31520000, 'https://images.pexels.com/photos/2044873/pexels-photo-2044873.jpeg?auto=compress&cs=tinysrgb&w=800', true, 'active', 'ready', 4, 8, NULL),
  ('stylo-160-abs', 'STYLO 160 ABS', 'Sport / Premium Matic', 34580000, 'https://images.pexels.com/photos/2044876/pexels-photo-2044876.jpeg?auto=compress&cs=tinysrgb&w=800', false, 'active', 'limited', 2, 9, NULL),
  ('stylo-160-abs-spc', 'STYLO 160 ABS SPC', 'Sport / Premium Matic', 36180000, 'https://images.pexels.com/photos/13611191/pexels-photo-13611191.jpeg?auto=compress&cs=tinysrgb&w=800', false, 'active', 'limited', 1, 10, NULL),
  ('vario-125-street-visor', 'VARIO 125 STREET VISOR', 'Matic', 28950000, 'https://images.pexels.com/photos/2044868/pexels-photo-2044868.jpeg?auto=compress&cs=tinysrgb&w=800', false, 'active', 'ready', 5, 11, NULL),
  ('vario-125-cbs', 'VARIO 125 CBS', 'Matic', 26530000, 'https://images.pexels.com/photos/5027485/pexels-photo-5027485.jpeg?auto=compress&cs=tinysrgb&w=800', true, 'active', 'ready', 8, 12, NULL),
  ('vario-125-iss', 'VARIO 125 ISS', 'Matic', 28430000, 'https://images.pexels.com/photos/2830762/pexels-photo-2830762.jpeg?auto=compress&cs=tinysrgb&w=800', false, 'active', 'ready', 4, 13, NULL),
  ('vario-evo-160-cbs', 'VARIO EVO 160 CBS', 'Sport / Premium Matic', 30270000, 'https://images.pexels.com/photos/2044873/pexels-photo-2044873.jpeg?auto=compress&cs=tinysrgb&w=800', true, 'active', 'ready', 5, 14, NULL),
  ('vario-evo-160-cbs-nitro', 'VARIO EVO 160 CBS NITRO', 'Sport / Premium Matic', 30520000, 'https://images.pexels.com/photos/2044876/pexels-photo-2044876.jpeg?auto=compress&cs=tinysrgb&w=800', false, 'active', 'ready', 3, 15, NULL),
  ('vario-evo-160-abs', 'VARIO EVO 160 ABS', 'Sport / Premium Matic', 33360000, 'https://images.pexels.com/photos/13611191/pexels-photo-13611191.jpeg?auto=compress&cs=tinysrgb&w=800', false, 'active', 'limited', 2, 16, NULL),
  ('pcx-160-cbs', 'PCX 160 CBS', 'Sport / Premium Matic', 36640000, 'https://images.pexels.com/photos/2044868/pexels-photo-2044868.jpeg?auto=compress&cs=tinysrgb&w=800', true, 'active', 'ready', 3, 17, NULL),
  ('pcx-160-abs', 'PCX 160 ABS', 'Sport / Premium Matic', 40380000, 'https://images.pexels.com/photos/5027485/pexels-photo-5027485.jpeg?auto=compress&cs=tinysrgb&w=800', false, 'active', 'indent', 0, 18, NULL),
  ('pcx-160-roadsync', 'PCX 160 Roadsync', 'Sport / Premium Matic', 43540000, 'https://images.pexels.com/photos/2830762/pexels-photo-2830762.jpeg?auto=compress&cs=tinysrgb&w=800', false, 'active', 'indent', 0, 19, NULL),
  ('adv-160-cbs', 'ADV 160 CBS', 'Sport / Premium Matic', 38830000, 'https://images.pexels.com/photos/2044873/pexels-photo-2044873.jpeg?auto=compress&cs=tinysrgb&w=800', true, 'active', 'ready', 2, 20, NULL),
  ('adv-160-abs', 'ADV 160 ABS', 'Sport / Premium Matic', 41950000, 'https://images.pexels.com/photos/2044876/pexels-photo-2044876.jpeg?auto=compress&cs=tinysrgb&w=800', false, 'active', 'limited', 1, 21, NULL),
  ('adv-160-roadsync', 'ADV 160 Roadsync', 'Sport / Premium Matic', 43720000, 'https://images.pexels.com/photos/13611191/pexels-photo-13611191.jpeg?auto=compress&cs=tinysrgb&w=800', false, 'active', 'indent', 0, 22, NULL)
ON CONFLICT (slug) DO NOTHING;

-- ============ SEED FINANCING PLANS ============
INSERT INTO financing_plans (product_id, dp, tenor35, tenor47, provider, status, sort_order)
SELECT p.id, v.dp, v.tenor35, v.tenor47, NULL, 'active', v.sort_order
FROM products p
JOIN (VALUES
  ('beat-cbs', 2200000, 906000, 740000, 1),
  ('beat-cbs', 2500000, 892000, 728000, 2),
  ('beat-cbs', 2750000, 881000, 719000, 3),
  ('beat-deluxe', 2300000, 937000, 767000, 1),
  ('beat-deluxe', 2500000, 939000, 769000, 2),
  ('beat-deluxe', 2750000, 928000, 759000, 3),
  ('beat-smart-key', 2300000, 964000, 790000, 1),
  ('beat-smart-key', 2500000, 955000, 782000, 2),
  ('beat-smart-key', 2750000, 944000, 773000, 3),
  ('beat-street', 2200000, 913000, 746000, 1),
  ('beat-street', 2500000, 899000, 735000, 2),
  ('beat-street', 2750000, 898000, 725000, 3),
  ('beat-street-plus', 2300000, 939000, 769000, 1),
  ('beat-street-plus', 2500000, 930000, 761000, 2),
  ('beat-street-plus', 2750000, 919000, 752000, 3),
  ('scoopy-fashion', 2600000, 1082000, 881000, 1),
  ('scoopy-fashion', 2750000, 1075000, 876000, 2),
  ('scoopy-fashion', 3000000, 1064000, 866000, 3),
  ('scoopy-prestige', 2700000, 1117000, 911000, 1),
  ('scoopy-prestige', 3000000, 1115000, 909000, 2),
  ('scoopy-prestige', 3250000, 1104000, 900000, 3),
  ('stylo-160-cbs', 3200000, 1360000, 1123000, 1),
  ('stylo-160-cbs', 3500000, 1335000, 1102000, 2),
  ('stylo-160-cbs', 3750000, 1324000, 1093000, 3),
  ('stylo-160-abs', 3500000, 1485000, 1230000, 1),
  ('stylo-160-abs', 3750000, 1474000, 1220000, 2),
  ('stylo-160-abs', 4000000, 1463000, 1211000, 3),
  ('stylo-160-abs-spc', 3700000, 1559000, 1294000, 1),
  ('stylo-160-abs-spc', 4000000, 1545000, 1282000, 2),
  ('stylo-160-abs-spc', 4250000, 1534000, 1273000, 3),
  ('vario-125-street-visor', 3000000, 1174000, 1011000, 1),
  ('vario-125-street-visor', 3250000, 1163000, 1002000, 2),
  ('vario-125-street-visor', 3500000, 1152000, 993000, 3),
  ('vario-125-cbs', 2700000, 1150000, 943000, 1),
  ('vario-125-cbs', 3000000, 1137000, 932000, 2),
  ('vario-125-cbs', 3250000, 1126000, 922000, 3),
  ('vario-125-iss', 3000000, 1223000, 1004000, 1),
  ('vario-125-iss', 3250000, 1212000, 995000, 2),
  ('vario-125-iss', 3500000, 1200000, 986000, 3),
  ('vario-evo-160-cbs', 3100000, 1280000, 1061000, 1),
  ('vario-evo-160-cbs', 3250000, 1274000, 1055000, 2),
  ('vario-evo-160-cbs', 3500000, 1262000, 1046000, 3),
  ('vario-evo-160-cbs-nitro', 3100000, 1293000, 1072000, 1),
  ('vario-evo-160-cbs-nitro', 3250000, 1286000, 1066000, 2),
  ('vario-evo-160-cbs-nitro', 3500000, 1275000, 1056000, 3),
  ('vario-evo-160-abs', 3500000, 1404000, 1167000, 1),
  ('vario-evo-160-abs', 3750000, 1393000, 1157000, 2),
  ('vario-evo-160-abs', 4000000, 1381000, 1148000, 3),
  ('pcx-160-cbs', 3700000, 1546000, 1287000, 1),
  ('pcx-160-cbs', 4000000, 1532000, 1276000, 2),
  ('pcx-160-cbs', 4500000, 1510000, 1257000, 3),
  ('pcx-160-abs', 4100000, 1697000, 1417000, 1),
  ('pcx-160-abs', 4500000, 1680000, 1402000, 2),
  ('pcx-160-abs', 5000000, 1657000, 1383000, 3),
  ('pcx-160-roadsync', 4500000, 1845000, 1548000, 1),
  ('pcx-160-roadsync', 5000000, 1823000, 1528000, 2),
  ('pcx-160-roadsync', 5500000, 1800000, 1509000, 3),
  ('adv-160-cbs', 4000000, 1626000, 1354000, 1),
  ('adv-160-cbs', 4500000, 1604000, 1336000, 2),
  ('adv-160-cbs', 5000000, 1581000, 1317000, 3),
  ('adv-160-abs', 4200000, 1758000, 1467000, 1),
  ('adv-160-abs', 4500000, 1744000, 1456000, 2),
  ('adv-160-abs', 5000000, 1722000, 1437000, 3),
  ('adv-160-roadsync', 4500000, 1825000, 1524000, 1),
  ('adv-160-roadsync', 5000000, 1802000, 1505000, 2),
  ('adv-160-roadsync', 5500000, 1780000, 1486000, 3)
) AS v(slug, dp, tenor35, tenor47, sort_order)
ON p.slug = v.slug
WHERE NOT EXISTS (
  SELECT 1 FROM financing_plans fp
  WHERE fp.product_id = p.id AND fp.dp = v.dp AND fp.tenor35 = v.tenor35
);

-- ============ SEED FAQS ============
INSERT INTO faqs (question, answer, sort_order, status)
VALUES
  ('Berapa DP motor Honda?', 'DP motor Honda bervariasi tergantung tipe motor. DP mulai dari Rp2.200.000 untuk motor seperti BeAT CBS hingga Rp5.500.000 untuk motor premium seperti PCX 160 Roadsync. Anda dapat memilih dari 3 pilihan DP yang tersedia untuk setiap motor.', 1, 'active'),
  ('Berapa cicilan Honda BeAT?', 'Cicilan Honda BeAT tergantung pilihan DP dan tenor. Untuk BeAT CBS dengan DP Rp2.500.000, cicilan 35x adalah Rp892.000/bulan dan 47x adalah Rp728.000/bulan. Cek halaman detail setiap motor untuk pilihan DP dan cicilan lainnya.', 2, 'active'),
  ('Berapa cicilan Honda Scoopy?', 'Cicilan Honda Scoopy Fashion dengan DP Rp2.600.000, cicilan 35x adalah Rp1.082.000/bulan dan 47x adalah Rp881.000/bulan. Untuk Scoopy Prestige dengan DP Rp2.700.000, cicilan 35x adalah Rp1.117.000/bulan dan 47x adalah Rp911.000/bulan.', 3, 'active'),
  ('Berapa cicilan Honda Vario?', 'Cicilan Honda Vario 125 CBS dengan DP Rp2.700.000, cicilan 35x adalah Rp1.150.000/bulan dan 47x adalah Rp943.000/bulan. Untuk Vario EVO 160 CBS dengan DP Rp3.100.000, cicilan 35x adalah Rp1.280.000/bulan dan 47x adalah Rp1.061.000/bulan.', 4, 'active'),
  ('Berapa cicilan Honda PCX?', 'Cicilan Honda PCX 160 CBS dengan DP Rp3.700.000, cicilan 35x adalah Rp1.546.000/bulan dan 47x adalah Rp1.287.000/bulan. Untuk PCX 160 ABS dengan DP Rp4.100.000, cicilan 35x adalah Rp1.697.000/bulan dan 47x adalah Rp1.417.000/bulan.', 5, 'active'),
  ('Berapa cicilan Honda ADV?', 'Cicilan Honda ADV 160 CBS dengan DP Rp4.000.000, cicilan 35x adalah Rp1.626.000/bulan dan 47x adalah Rp1.354.000/bulan. Untuk ADV 160 ABS dengan DP Rp4.200.000, cicilan 35x adalah Rp1.758.000/bulan dan 47x adalah Rp1.467.000/bulan.', 6, 'active'),
  ('Apakah bisa kredit motor Honda?', 'Ya, Anda bisa mengajukan kredit motor Honda dengan berbagai pilihan DP dan tenor 35x atau 47x. Hubungi sales kami melalui WhatsApp untuk konsultasi dan simulasi terbaru.', 7, 'active'),
  ('Apakah melayani Pekalongan?', 'Ya, kami melayani penjualan dan kredit motor Honda untuk wilayah Pekalongan dan sekitarnya. Hubungi kami melalui WhatsApp untuk informasi lebih lanjut.', 8, 'active'),
  ('Apakah melayani Pemalang?', 'Ya, kami melayani penjualan dan kredit motor Honda untuk wilayah Pemalang dan sekitarnya. Hubungi kami melalui WhatsApp untuk informasi lebih lanjut.', 9, 'active'),
  ('Apakah melayani Batang?', 'Ya, kami melayani penjualan dan kredit motor Honda untuk wilayah Batang dan sekitarnya. Hubungi kami melalui WhatsApp untuk informasi lebih lanjut.', 10, 'active'),
  ('Bagaimana cara mengajukan kredit?', 'Cara mengajukan kredit sangat mudah: 1) Pilih motor yang Anda inginkan, 2) Pilih DP dan tenor, 3) Chat WhatsApp sales kami untuk konsultasi, 4) Sales akan membantu proses selanjutnya. Tidak perlu login atau membuat akun.', 11, 'active')
ON CONFLICT DO NOTHING;
