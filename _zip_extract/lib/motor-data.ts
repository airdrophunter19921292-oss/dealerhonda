export interface FinancingOption {
  dp: number;
  tenor35: number;
  tenor47: number;
}

export interface Motor {
  id: string;
  name: string;
  category: 'Matic' | 'Urban' | 'Sport / Premium Matic';
  otr: number;
  image: string;
  popular: boolean;
  financing: FinancingOption[];
}

export const motorData: Motor[] = [
  {
    id: 'beat-cbs',
    name: 'BeAT CBS',
    category: 'Matic',
    otr: 21270000,
    image: 'https://images.pexels.com/photos/2830762/pexels-photo-2830762.jpeg?auto=compress&cs=tinysrgb&w=800',
    popular: true,
    financing: [
      { dp: 2200000, tenor35: 906000, tenor47: 740000 },
      { dp: 2500000, tenor35: 892000, tenor47: 728000 },
      { dp: 2750000, tenor35: 881000, tenor47: 719000 },
    ],
  },
  {
    id: 'beat-deluxe',
    name: 'BeAT Deluxe',
    category: 'Matic',
    otr: 22070000,
    image: 'https://images.pexels.com/photos/2044873/pexels-photo-2044873.jpeg?auto=compress&cs=tinysrgb&w=800',
    popular: true,
    financing: [
      { dp: 2300000, tenor35: 937000, tenor47: 767000 },
      { dp: 2500000, tenor35: 939000, tenor47: 769000 },
      { dp: 2750000, tenor35: 928000, tenor47: 759000 },
    ],
  },
  {
    id: 'beat-smart-key',
    name: 'BeAT Smart Key',
    category: 'Matic',
    otr: 22670000,
    image: 'https://images.pexels.com/photos/2044876/pexels-photo-2044876.jpeg?auto=compress&cs=tinysrgb&w=800',
    popular: false,
    financing: [
      { dp: 2300000, tenor35: 964000, tenor47: 790000 },
      { dp: 2500000, tenor35: 955000, tenor47: 782000 },
      { dp: 2750000, tenor35: 944000, tenor47: 773000 },
    ],
  },
  {
    id: 'beat-street',
    name: 'BeAT Street (MM1 - MM2)',
    category: 'Matic',
    otr: 21430000,
    image: 'https://images.pexels.com/photos/13611191/pexels-photo-13611191.jpeg?auto=compress&cs=tinysrgb&w=800',
    popular: false,
    financing: [
      { dp: 2200000, tenor35: 913000, tenor47: 746000 },
      { dp: 2500000, tenor35: 899000, tenor47: 735000 },
      { dp: 2750000, tenor35: 898000, tenor47: 725000 },
    ],
  },
  {
    id: 'beat-street-plus',
    name: 'BeAT Street Plus (MM2A)',
    category: 'Matic',
    otr: 22120000,
    image: 'https://images.pexels.com/photos/2044868/pexels-photo-2044868.jpeg?auto=compress&cs=tinysrgb&w=800',
    popular: false,
    financing: [
      { dp: 2300000, tenor35: 939000, tenor47: 769000 },
      { dp: 2500000, tenor35: 930000, tenor47: 761000 },
      { dp: 2750000, tenor35: 919000, tenor47: 752000 },
    ],
  },
  {
    id: 'scoopy-fashion',
    name: 'Scoopy Fashion',
    category: 'Matic',
    otr: 25350000,
    image: 'https://images.pexels.com/photos/5027485/pexels-photo-5027485.jpeg?auto=compress&cs=tinysrgb&w=800',
    popular: true,
    financing: [
      { dp: 2600000, tenor35: 1082000, tenor47: 881000 },
      { dp: 2750000, tenor35: 1075000, tenor47: 876000 },
      { dp: 3000000, tenor35: 1064000, tenor47: 866000 },
    ],
  },
  {
    id: 'scoopy-prestige',
    name: 'Scoopy Prestige / Stylish',
    category: 'Matic',
    otr: 26230000,
    image: 'https://images.pexels.com/photos/2830762/pexels-photo-2830762.jpeg?auto=compress&cs=tinysrgb&w=800',
    popular: true,
    financing: [
      { dp: 2700000, tenor35: 1117000, tenor47: 911000 },
      { dp: 3000000, tenor35: 1115000, tenor47: 909000 },
      { dp: 3250000, tenor35: 1104000, tenor47: 900000 },
    ],
  },
  {
    id: 'stylo-160-cbs',
    name: 'STYLO 160 CBS',
    category: 'Sport / Premium Matic',
    otr: 31520000,
    image: 'https://images.pexels.com/photos/2044873/pexels-photo-2044873.jpeg?auto=compress&cs=tinysrgb&w=800',
    popular: true,
    financing: [
      { dp: 3200000, tenor35: 1360000, tenor47: 1123000 },
      { dp: 3500000, tenor35: 1335000, tenor47: 1102000 },
      { dp: 3750000, tenor35: 1324000, tenor47: 1093000 },
    ],
  },
  {
    id: 'stylo-160-abs',
    name: 'STYLO 160 ABS',
    category: 'Sport / Premium Matic',
    otr: 34580000,
    image: 'https://images.pexels.com/photos/2044876/pexels-photo-2044876.jpeg?auto=compress&cs=tinysrgb&w=800',
    popular: false,
    financing: [
      { dp: 3500000, tenor35: 1485000, tenor47: 1230000 },
      { dp: 3750000, tenor35: 1474000, tenor47: 1220000 },
      { dp: 4000000, tenor35: 1463000, tenor47: 1211000 },
    ],
  },
  {
    id: 'stylo-160-abs-spc',
    name: 'STYLO 160 ABS SPC',
    category: 'Sport / Premium Matic',
    otr: 36180000,
    image: 'https://images.pexels.com/photos/13611191/pexels-photo-13611191.jpeg?auto=compress&cs=tinysrgb&w=800',
    popular: false,
    financing: [
      { dp: 3700000, tenor35: 1559000, tenor47: 1294000 },
      { dp: 4000000, tenor35: 1545000, tenor47: 1282000 },
      { dp: 4250000, tenor35: 1534000, tenor47: 1273000 },
    ],
  },
  {
    id: 'vario-125-street-visor',
    name: 'VARIO 125 STREET VISOR',
    category: 'Matic',
    otr: 28950000,
    image: 'https://images.pexels.com/photos/2044868/pexels-photo-2044868.jpeg?auto=compress&cs=tinysrgb&w=800',
    popular: false,
    financing: [
      { dp: 3000000, tenor35: 1174000, tenor47: 1011000 },
      { dp: 3250000, tenor35: 1163000, tenor47: 1002000 },
      { dp: 3500000, tenor35: 1152000, tenor47: 993000 },
    ],
  },
  {
    id: 'vario-125-cbs',
    name: 'VARIO 125 CBS',
    category: 'Matic',
    otr: 26530000,
    image: 'https://images.pexels.com/photos/5027485/pexels-photo-5027485.jpeg?auto=compress&cs=tinysrgb&w=800',
    popular: true,
    financing: [
      { dp: 2700000, tenor35: 1150000, tenor47: 943000 },
      { dp: 3000000, tenor35: 1137000, tenor47: 932000 },
      { dp: 3250000, tenor35: 1126000, tenor47: 922000 },
    ],
  },
  {
    id: 'vario-125-iss',
    name: 'VARIO 125 ISS',
    category: 'Matic',
    otr: 28430000,
    image: 'https://images.pexels.com/photos/2830762/pexels-photo-2830762.jpeg?auto=compress&cs=tinysrgb&w=800',
    popular: false,
    financing: [
      { dp: 3000000, tenor35: 1223000, tenor47: 1004000 },
      { dp: 3250000, tenor35: 1212000, tenor47: 995000 },
      { dp: 3500000, tenor35: 1200000, tenor47: 986000 },
    ],
  },
  {
    id: 'vario-evo-160-cbs',
    name: 'VARIO EVO 160 CBS',
    category: 'Sport / Premium Matic',
    otr: 30270000,
    image: 'https://images.pexels.com/photos/2044873/pexels-photo-2044873.jpeg?auto=compress&cs=tinysrgb&w=800',
    popular: true,
    financing: [
      { dp: 3100000, tenor35: 1280000, tenor47: 1061000 },
      { dp: 3250000, tenor35: 1274000, tenor47: 1055000 },
      { dp: 3500000, tenor35: 1262000, tenor47: 1046000 },
    ],
  },
  {
    id: 'vario-evo-160-cbs-nitro',
    name: 'VARIO EVO 160 CBS NITRO',
    category: 'Sport / Premium Matic',
    otr: 30520000,
    image: 'https://images.pexels.com/photos/2044876/pexels-photo-2044876.jpeg?auto=compress&cs=tinysrgb&w=800',
    popular: false,
    financing: [
      { dp: 3100000, tenor35: 1293000, tenor47: 1072000 },
      { dp: 3250000, tenor35: 1286000, tenor47: 1066000 },
      { dp: 3500000, tenor35: 1275000, tenor47: 1056000 },
    ],
  },
  {
    id: 'vario-evo-160-abs',
    name: 'VARIO EVO 160 ABS',
    category: 'Sport / Premium Matic',
    otr: 33360000,
    image: 'https://images.pexels.com/photos/13611191/pexels-photo-13611191.jpeg?auto=compress&cs=tinysrgb&w=800',
    popular: false,
    financing: [
      { dp: 3500000, tenor35: 1404000, tenor47: 1167000 },
      { dp: 3750000, tenor35: 1393000, tenor47: 1157000 },
      { dp: 4000000, tenor35: 1381000, tenor47: 1148000 },
    ],
  },
  {
    id: 'pcx-160-cbs',
    name: 'PCX 160 CBS',
    category: 'Sport / Premium Matic',
    otr: 36640000,
    image: 'https://images.pexels.com/photos/2044868/pexels-photo-2044868.jpeg?auto=compress&cs=tinysrgb&w=800',
    popular: true,
    financing: [
      { dp: 3700000, tenor35: 1546000, tenor47: 1287000 },
      { dp: 4000000, tenor35: 1532000, tenor47: 1276000 },
      { dp: 4500000, tenor35: 1510000, tenor47: 1257000 },
    ],
  },
  {
    id: 'pcx-160-abs',
    name: 'PCX 160 ABS',
    category: 'Sport / Premium Matic',
    otr: 40380000,
    image: 'https://images.pexels.com/photos/5027485/pexels-photo-5027485.jpeg?auto=compress&cs=tinysrgb&w=800',
    popular: false,
    financing: [
      { dp: 4100000, tenor35: 1697000, tenor47: 1417000 },
      { dp: 4500000, tenor35: 1680000, tenor47: 1402000 },
      { dp: 5000000, tenor35: 1657000, tenor47: 1383000 },
    ],
  },
  {
    id: 'pcx-160-roadsync',
    name: 'PCX 160 Roadsync',
    category: 'Sport / Premium Matic',
    otr: 43540000,
    image: 'https://images.pexels.com/photos/2830762/pexels-photo-2830762.jpeg?auto=compress&cs=tinysrgb&w=800',
    popular: false,
    financing: [
      { dp: 4500000, tenor35: 1845000, tenor47: 1548000 },
      { dp: 5000000, tenor35: 1823000, tenor47: 1528000 },
      { dp: 5500000, tenor35: 1800000, tenor47: 1509000 },
    ],
  },
  {
    id: 'adv-160-cbs',
    name: 'ADV 160 CBS',
    category: 'Sport / Premium Matic',
    otr: 38830000,
    image: 'https://images.pexels.com/photos/2044873/pexels-photo-2044873.jpeg?auto=compress&cs=tinysrgb&w=800',
    popular: true,
    financing: [
      { dp: 4000000, tenor35: 1626000, tenor47: 1354000 },
      { dp: 4500000, tenor35: 1604000, tenor47: 1336000 },
      { dp: 5000000, tenor35: 1581000, tenor47: 1317000 },
    ],
  },
  {
    id: 'adv-160-abs',
    name: 'ADV 160 ABS',
    category: 'Sport / Premium Matic',
    otr: 41950000,
    image: 'https://images.pexels.com/photos/2044876/pexels-photo-2044876.jpeg?auto=compress&cs=tinysrgb&w=800',
    popular: false,
    financing: [
      { dp: 4200000, tenor35: 1758000, tenor47: 1467000 },
      { dp: 4500000, tenor35: 1744000, tenor47: 1456000 },
      { dp: 5000000, tenor35: 1722000, tenor47: 1437000 },
    ],
  },
  {
    id: 'adv-160-roadsync',
    name: 'ADV 160 Roadsync',
    category: 'Sport / Premium Matic',
    otr: 43720000,
    image: 'https://images.pexels.com/photos/13611191/pexels-photo-13611191.jpeg?auto=compress&cs=tinysrgb&w=800',
    popular: false,
    financing: [
      { dp: 4500000, tenor35: 1825000, tenor47: 1524000 },
      { dp: 5000000, tenor35: 1802000, tenor47: 1505000 },
      { dp: 5500000, tenor35: 1780000, tenor47: 1486000 },
    ],
  },
];

export const motorCategories = ['Matic', 'Urban', 'Sport / Premium Matic'] as const;
