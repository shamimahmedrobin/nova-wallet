// All ISO 4217 currencies + auto-detection from device timezone / locale.
// Display order in pickers: USD, EUR, BDT pinned first, then A–Z.
export interface Currency { code: string; name: string }
export const PINNED = ['USD', 'EUR', 'BDT']
export const CURRENCIES: Currency[] = [
  ['USD', 'US Dollar'], ['EUR', 'Euro'], ['BDT', 'Bangladeshi Taka'],
  ['AED', 'UAE Dirham'], ['AFN', 'Afghan Afghani'], ['ALL', 'Albanian Lek'], ['AMD', 'Armenian Dram'],
  ['ANG', 'Netherlands Antillean Guilder'], ['AOA', 'Angolan Kwanza'], ['ARS', 'Argentine Peso'],
  ['AUD', 'Australian Dollar'], ['AWG', 'Aruban Florin'], ['AZN', 'Azerbaijani Manat'],
  ['BAM', 'Bosnia-Herzegovina Convertible Mark'], ['BBD', 'Barbadian Dollar'], ['BGN', 'Bulgarian Lev'],
  ['BHD', 'Bahraini Dinar'], ['BIF', 'Burundian Franc'], ['BMD', 'Bermudian Dollar'], ['BND', 'Brunei Dollar'],
  ['BOB', 'Bolivian Boliviano'], ['BRL', 'Brazilian Real'], ['BSD', 'Bahamian Dollar'], ['BTN', 'Bhutanese Ngultrum'],
  ['BWP', 'Botswana Pula'], ['BYN', 'Belarusian Ruble'], ['BZD', 'Belize Dollar'], ['CAD', 'Canadian Dollar'],
  ['CDF', 'Congolese Franc'], ['CHF', 'Swiss Franc'], ['CLP', 'Chilean Peso'], ['CNY', 'Chinese Yuan'],
  ['COP', 'Colombian Peso'], ['CRC', 'Costa Rican Colón'], ['CUP', 'Cuban Peso'], ['CVE', 'Cape Verdean Escudo'],
  ['CZK', 'Czech Koruna'], ['DJF', 'Djiboutian Franc'], ['DKK', 'Danish Krone'], ['DOP', 'Dominican Peso'],
  ['DZD', 'Algerian Dinar'], ['EGP', 'Egyptian Pound'], ['ERN', 'Eritrean Nakfa'], ['ETB', 'Ethiopian Birr'],
  ['FJD', 'Fijian Dollar'], ['FKP', 'Falkland Islands Pound'], ['GBP', 'British Pound'], ['GEL', 'Georgian Lari'],
  ['GGP', 'Guernsey Pound'], ['GHS', 'Ghanaian Cedi'], ['GIP', 'Gibraltar Pound'], ['GMD', 'Gambian Dalasi'],
  ['GNF', 'Guinean Franc'], ['GTQ', 'Guatemalan Quetzal'], ['GYD', 'Guyanese Dollar'], ['HKD', 'Hong Kong Dollar'],
  ['HNL', 'Honduran Lempira'], ['HRK', 'Croatian Kuna'], ['HTG', 'Haitian Gourde'], ['HUF', 'Hungarian Forint'],
  ['IDR', 'Indonesian Rupiah'], ['ILS', 'Israeli Shekel'], ['IMP', 'Isle of Man Pound'], ['INR', 'Indian Rupee'],
  ['IQD', 'Iraqi Dinar'], ['IRR', 'Iranian Rial'], ['ISK', 'Icelandic Króna'], ['JEP', 'Jersey Pound'],
  ['JMD', 'Jamaican Dollar'], ['JOD', 'Jordanian Dinar'], ['JPY', 'Japanese Yen'], ['KES', 'Kenyan Shilling'],
  ['KGS', 'Kyrgyzstani Som'], ['KHR', 'Cambodian Riel'], ['KMF', 'Comorian Franc'], ['KPW', 'North Korean Won'],
  ['KRW', 'South Korean Won'], ['KWD', 'Kuwaiti Dinar'], ['KYD', 'Cayman Islands Dollar'], ['KZT', 'Kazakhstani Tenge'],
  ['LAK', 'Laotian Kip'], ['LBP', 'Lebanese Pound'], ['LKR', 'Sri Lankan Rupee'], ['LRD', 'Liberian Dollar'],
  ['LSL', 'Lesotho Loti'], ['LYD', 'Libyan Dinar'], ['MAD', 'Moroccan Dirham'], ['MDL', 'Moldovan Leu'],
  ['MGA', 'Malagasy Ariary'], ['MKD', 'Macedonian Denar'], ['MMK', 'Burmese Kyat'], ['MNT', 'Mongolian Tugrik'],
  ['MOP', 'Macanese Pataca'], ['MRU', 'Mauritanian Ouguiya'], ['MUR', 'Mauritian Rupee'], ['MVR', 'Maldivian Rufiyaa'],
  ['MWK', 'Malawian Kwacha'], ['MXN', 'Mexican Peso'], ['MYR', 'Malaysian Ringgit'], ['MZN', 'Mozambican Metical'],
  ['NAD', 'Namibian Dollar'], ['NGN', 'Nigerian Naira'], ['NIO', 'Nicaraguan Córdoba'], ['NOK', 'Norwegian Krone'],
  ['NPR', 'Nepalese Rupee'], ['NZD', 'New Zealand Dollar'], ['OMR', 'Omani Rial'], ['PAB', 'Panamanian Balboa'],
  ['PEN', 'Peruvian Sol'], ['PGK', 'Papua New Guinean Kina'], ['PHP', 'Philippine Peso'], ['PKR', 'Pakistani Rupee'],
  ['PLN', 'Polish Złoty'], ['PYG', 'Paraguayan Guaraní'], ['QAR', 'Qatari Rial'], ['RON', 'Romanian Leu'],
  ['RSD', 'Serbian Dinar'], ['RUB', 'Russian Ruble'], ['RWF', 'Rwandan Franc'], ['SAR', 'Saudi Riyal'],
  ['SBD', 'Solomon Islands Dollar'], ['SCR', 'Seychellois Rupee'], ['SDG', 'Sudanese Pound'], ['SEK', 'Swedish Krona'],
  ['SGD', 'Singapore Dollar'], ['SHP', 'Saint Helena Pound'], ['SLE', 'Sierra Leonean Leone'], ['SOS', 'Somali Shilling'],
  ['SRD', 'Surinamese Dollar'], ['SSP', 'South Sudanese Pound'], ['STN', 'São Tomé and Príncipe Dobra'],
  ['SYP', 'Syrian Pound'], ['SZL', 'Swazi Lilangeni'], ['THB', 'Thai Baht'], ['TJS', 'Tajikistani Somoni'],
  ['TMT', 'Turkmenistani Manat'], ['TND', 'Tunisian Dinar'], ['TOP', 'Tongan Paʻanga'], ['TRY', 'Turkish Lira'],
  ['TTD', 'Trinidad and Tobago Dollar'], ['TVD', 'Tuvaluan Dollar'], ['TWD', 'New Taiwan Dollar'],
  ['TZS', 'Tanzanian Shilling'], ['UAH', 'Ukrainian Hryvnia'], ['UGX', 'Ugandan Shilling'], ['UYU', 'Uruguayan Peso'],
  ['UZS', 'Uzbekistani Som'], ['VES', 'Venezuelan Bolívar'], ['VND', 'Vietnamese Đồng'], ['VUV', 'Vanuatu Vatu'],
  ['WST', 'Samoan Tala'], ['XAF', 'Central African CFA Franc'], ['XCD', 'East Caribbean Dollar'],
  ['XOF', 'West African CFA Franc'], ['XPF', 'CFP Franc'], ['YER', 'Yemeni Rial'], ['ZAR', 'South African Rand'],
  ['ZMW', 'Zambian Kwacha'], ['ZWL', 'Zimbabwean Dollar'],
].map(([code, name]) => ({ code, name }))
export const currencyName = (code: string) => CURRENCIES.find(c => c.code === code)?.name ?? code

// IANA timezone -> currency (device location signal)
const TZ_CURRENCY: Record<string, string> = {
  'Asia/Dhaka': 'BDT', 'Asia/Kolkata': 'INR', 'Asia/Calcutta': 'INR', 'Asia/Karachi': 'PKR', 'Asia/Colombo': 'LKR',
  'Asia/Kathmandu': 'NPR', 'Asia/Dubai': 'AED', 'Asia/Riyadh': 'SAR', 'Asia/Qatar': 'QAR', 'Asia/Kuwait': 'KWD',
  'Asia/Muscat': 'OMR', 'Asia/Bahrain': 'BHD', 'Asia/Amman': 'JOD', 'Asia/Beirut': 'LBP', 'Asia/Baghdad': 'IQD',
  'Asia/Tehran': 'IRR', 'Asia/Kabul': 'AFN', 'Asia/Almaty': 'KZT', 'Asia/Tashkent': 'UZS', 'Asia/Bishkek': 'KGS',
  'Asia/Dushanbe': 'TJS', 'Asia/Ashgabat': 'TMT', 'Asia/Baku': 'AZN', 'Asia/Tbilisi': 'GEL', 'Asia/Yerevan': 'AMD',
  'Asia/Singapore': 'SGD', 'Asia/Kuala_Lumpur': 'MYR', 'Asia/Jakarta': 'IDR', 'Asia/Makassar': 'IDR', 'Asia/Jayapura': 'IDR',
  'Asia/Bangkok': 'THB', 'Asia/Ho_Chi_Minh': 'VND', 'Asia/Hanoi': 'VND', 'Asia/Manila': 'PHP', 'Asia/Brunei': 'BND',
  'Asia/Phnom_Penh': 'KHR', 'Asia/Vientiane': 'LAK', 'Asia/Yangon': 'MMK', 'Asia/Rangoon': 'MMK',
  'Asia/Shanghai': 'CNY', 'Asia/Chongqing': 'CNY', 'Asia/Hong_Kong': 'HKD', 'Asia/Taipei': 'TWD', 'Asia/Macau': 'MOP',
  'Asia/Tokyo': 'JPY', 'Asia/Seoul': 'KRW', 'Asia/Pyongyang': 'KPW', 'Asia/Ulaanbaatar': 'MNT', 'Asia/Jerusalem': 'ILS', 'Asia/Tel_Aviv': 'ILS',
  'Europe/London': 'GBP', 'Europe/Zurich': 'CHF', 'Europe/Warsaw': 'PLN', 'Europe/Stockholm': 'SEK', 'Europe/Oslo': 'NOK',
  'Europe/Copenhagen': 'DKK', 'Europe/Prague': 'CZK', 'Europe/Budapest': 'HUF', 'Europe/Moscow': 'RUB', 'Europe/Istanbul': 'TRY',
  'Asia/Istanbul': 'TRY', 'Europe/Kiev': 'UAH', 'Europe/Kyiv': 'UAH', 'Europe/Minsk': 'BYN', 'Europe/Bucharest': 'RON',
  'Europe/Sofia': 'BGN', 'Europe/Belgrade': 'RSD', 'Europe/Tirane': 'ALL', 'Europe/Skopje': 'MKD', 'Europe/Chisinau': 'MDL',
  'Europe/Reykjavik': 'ISK', 'Europe/Zagreb': 'EUR',
  'America/Toronto': 'CAD', 'America/Vancouver': 'CAD', 'America/Winnipeg': 'CAD', 'America/Montreal': 'CAD',
  'America/Mexico_City': 'MXN', 'America/Sao_Paulo': 'BRL', 'America/Santiago': 'CLP', 'America/Bogota': 'COP',
  'America/Lima': 'PEN', 'America/Argentina/Buenos_Aires': 'ARS', 'America/Argentina/Cordoba': 'ARS', 'America/Caracas': 'VES',
  'America/La_Paz': 'BOB', 'America/Asuncion': 'PYG', 'America/Montevideo': 'UYU', 'America/Guatemala': 'GTQ',
  'America/Tegucigalpa': 'HNL', 'America/Managua': 'NIO', 'America/Panama': 'PAB', 'America/Havana': 'CUP',
  'America/Santo_Domingo': 'DOP', 'America/Port-au-Prince': 'HTG', 'America/Jamaica': 'JMD',
  'Australia/Sydney': 'AUD', 'Australia/Melbourne': 'AUD', 'Australia/Brisbane': 'AUD', 'Australia/Perth': 'AUD', 'Australia/Adelaide': 'AUD',
  'Pacific/Auckland': 'NZD', 'Pacific/Fiji': 'FJD', 'Pacific/Port_Moresby': 'PGK', 'Pacific/Tongatapu': 'TOP', 'Pacific/Apia': 'WST',
  'Africa/Lagos': 'NGN', 'Africa/Johannesburg': 'ZAR', 'Africa/Cairo': 'EGP', 'Africa/Nairobi': 'KES', 'Africa/Accra': 'GHS',
  'Africa/Casablanca': 'MAD', 'Africa/Algiers': 'DZD', 'Africa/Tunis': 'TND', 'Africa/Tripoli': 'LYD', 'Africa/Khartoum': 'SDG',
  'Africa/Addis_Ababa': 'ETB', 'Africa/Dar_es_Salaam': 'TZS', 'Africa/Kampala': 'UGX', 'Africa/Kigali': 'RWF',
  'Africa/Lusaka': 'ZMW', 'Africa/Harare': 'ZWL', 'Africa/Maputo': 'MZN', 'Africa/Luanda': 'AOA', 'Africa/Dakar': 'XOF',
  'Africa/Abidjan': 'XOF', 'Africa/Douala': 'XAF', 'Indian/Mauritius': 'MUR',
}
// Country/region (from locale) -> currency fallback
const REGION_CURRENCY: Record<string, string> = {
  BD: 'BDT', US: 'USD', IN: 'INR', PK: 'PKR', GB: 'GBP', AE: 'AED', SA: 'SAR', QA: 'QAR', KW: 'KWD', OM: 'OMR',
  BH: 'BHD', SG: 'SGD', MY: 'MYR', ID: 'IDR', TH: 'THB', VN: 'VND', PH: 'PHP', CN: 'CNY', HK: 'HKD', TW: 'TWD',
  JP: 'JPY', KR: 'KRW', AU: 'AUD', NZ: 'NZD', CA: 'CAD', MX: 'MXN', BR: 'BRL', CH: 'CHF', NO: 'NOK', SE: 'SEK',
  DK: 'DKK', PL: 'PLN', CZ: 'CZK', HU: 'HUF', RU: 'RUB', UA: 'UAH', TR: 'TRY', IL: 'ILS', EG: 'EGP', NG: 'NGN',
  ZA: 'ZAR', KE: 'KES', GH: 'GHS', LK: 'LKR', NP: 'NPR', MM: 'MMK', KH: 'KHR', LA: 'LAK', BN: 'BND', MN: 'MNT',
  KZ: 'KZT', UZ: 'UZS', AZ: 'AZN', GE: 'GEL', AM: 'AMD', AF: 'AFN', IQ: 'IQD', IR: 'IRR', JO: 'JOD', LB: 'LBP',
  CL: 'CLP', CO: 'COP', PE: 'PEN', AR: 'ARS', VE: 'VES', IS: 'ISK', RO: 'RON', BG: 'BGN', RS: 'RSD', AL: 'ALL', FJ: 'FJD',
}
const EUROZONE = new Set(['DE', 'FR', 'ES', 'IT', 'PT', 'NL', 'BE', 'AT', 'IE', 'FI', 'GR', 'SK', 'SI', 'EE', 'LV', 'LT', 'LU', 'MT', 'CY', 'HR'])

export interface DetectedCurrency { code: string; via: string }
export function detectCurrency(): DetectedCurrency {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz && TZ_CURRENCY[tz]) return { code: TZ_CURRENCY[tz], via: tz }
    if (tz?.startsWith('Europe/')) return { code: 'EUR', via: tz }
    if (tz?.startsWith('America/')) return { code: 'USD', via: tz }
  } catch { /* fall through */ }
  try {
    const loc = navigator.language || ''
    const region = loc.split('-')[1]?.toUpperCase()
    if (region) {
      if (EUROZONE.has(region)) return { code: 'EUR', via: loc }
      if (REGION_CURRENCY[region]) return { code: REGION_CURRENCY[region], via: loc }
    }
  } catch { /* ignore */ }
  return { code: 'USD', via: 'default' }
}

// Fallback USD-based rates if the live feed is unreachable (majors only; live feed covers all).
export const FALLBACK_RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, BDT: 119, GBP: 0.79, INR: 88, PKR: 278, AED: 3.67, SAR: 3.75, QAR: 3.64, KWD: 0.31,
  SGD: 1.29, MYR: 4.2, IDR: 16300, THB: 32.5, VND: 25400, PHP: 58.5, CNY: 7.1, HKD: 7.8, TWD: 31.5,
  JPY: 152, KRW: 1400, AUD: 1.52, NZD: 1.67, CAD: 1.4, MXN: 17.3, BRL: 5.8, CHF: 0.88, SEK: 10.4,
  NOK: 10.6, DKK: 6.9, PLN: 4.0, RUB: 96, TRY: 38.5, UAH: 41.5, ZAR: 17.5, NGN: 1550, EGP: 48.5, KES: 129, LKR: 290, NPR: 141,
}
