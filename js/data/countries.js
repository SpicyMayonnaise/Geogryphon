/* Bundled country data: the game works fully offline from this file.
   One row per ISO country or territory:
     code | ISO3 | name | capital | continent | official languages (;) | population in thousands | playable (1/0)
   Populations are rounded estimates (about 2024). "Playable" marks sovereign states (the 193 UN members,
   plus Vatican City and Taiwan). Territories stay in Flag mode but are skipped by Map and Trivia.
   Optional online refresh (countries.js) can update populations; it never changes anything else. */

const CONTINENT_NAMES = { AF: 'Africa', AS: 'Asia', EU: 'Europe', NA: 'North America', SA: 'South America', OC: 'Oceania', AN: 'Antarctic' };

const COUNTRY_ROWS = `
AD|AND|Andorra|Andorra la Vella|EU|Catalan|80|1
AE|ARE|United Arab Emirates|Abu Dhabi|AS|Arabic|10500|1
AF|AFG|Afghanistan|Kabul|AS|Pashto;Dari|42000|1
AG|ATG|Antigua and Barbuda|Saint John's|NA|English|94|1
AI|AIA|Anguilla|The Valley|NA|English|16|0
AL|ALB|Albania|Tirana|EU|Albanian|2800|1
AM|ARM|Armenia|Yerevan|AS|Armenian|2950|1
AO|AGO|Angola|Luanda|AF|Portuguese|37000|1
AR|ARG|Argentina|Buenos Aires|SA|Spanish|46000|1
AS|ASM|American Samoa|Pago Pago|OC|English;Samoan|44|0
AT|AUT|Austria|Vienna|EU|German|9100|1
AU|AUS|Australia|Canberra|OC|English|27000|1
AW|ABW|Aruba|Oranjestad|NA|Dutch;Papiamento|107|0
AX|ALA|Åland Islands|Mariehamn|EU|Swedish|30|0
AZ|AZE|Azerbaijan|Baku|AS|Azerbaijani|10200|1
BA|BIH|Bosnia and Herzegovina|Sarajevo|EU|Bosnian;Croatian;Serbian|3200|1
BB|BRB|Barbados|Bridgetown|NA|English|282|1
BD|BGD|Bangladesh|Dhaka|AS|Bengali|173000|1
BE|BEL|Belgium|Brussels|EU|Dutch;French;German|11800|1
BF|BFA|Burkina Faso|Ouagadougou|AF|French|23500|1
BG|BGR|Bulgaria|Sofia|EU|Bulgarian|6400|1
BH|BHR|Bahrain|Manama|AS|Arabic|1600|1
BI|BDI|Burundi|Gitega|AF|French;Kirundi|13700|1
BJ|BEN|Benin|Porto-Novo|AF|French|14100|1
BL|BLM|Saint Barthélemy|Gustavia|NA|French|11|0
BM|BMU|Bermuda|Hamilton|NA|English|64|0
BN|BRN|Brunei|Bandar Seri Begawan|AS|Malay|450|1
BO|BOL|Bolivia|Sucre|SA|Spanish;Quechua;Aymara;Guaraní|12400|1
BQ|BES|Caribbean Netherlands|Kralendijk|NA|Dutch|27|0
BR|BRA|Brazil|Brasília|SA|Portuguese|212000|1
BS|BHS|Bahamas|Nassau|NA|English|400|1
BT|BTN|Bhutan|Thimphu|AS|Dzongkha|780|1
BV|BVT|Bouvet Island||AN||0|0
BW|BWA|Botswana|Gaborone|AF|English;Tswana|2500|1
BY|BLR|Belarus|Minsk|EU|Belarusian;Russian|9200|1
BZ|BLZ|Belize|Belmopan|NA|English|410|1
CA|CAN|Canada|Ottawa|NA|English;French|41000|1
CC|CCK|Cocos (Keeling) Islands|West Island|OC|English|1|0
CD|COD|DR Congo|Kinshasa|AF|French|105000|1
CF|CAF|Central African Republic|Bangui|AF|French;Sango|5300|1
CG|COG|Republic of the Congo|Brazzaville|AF|French|6200|1
CH|CHE|Switzerland|Bern|EU|German;French;Italian;Romansh|8900|1
CI|CIV|Ivory Coast|Yamoussoukro|AF|French|31500|1
CK|COK|Cook Islands|Avarua|OC|English;Cook Islands Māori|15|0
CL|CHL|Chile|Santiago|SA|Spanish|19800|1
CM|CMR|Cameroon|Yaoundé|AF|English;French|28600|1
CN|CHN|China|Beijing|AS|Chinese|1411000|1
CO|COL|Colombia|Bogotá|SA|Spanish|52000|1
CR|CRI|Costa Rica|San José|NA|Spanish|5200|1
CU|CUB|Cuba|Havana|NA|Spanish|11000|1
CV|CPV|Cape Verde|Praia|AF|Portuguese|525|1
CW|CUW|Curaçao|Willemstad|NA|Dutch;Papiamento;English|155|0
CX|CXR|Christmas Island|Flying Fish Cove|OC|English|2|0
CY|CYP|Cyprus|Nicosia|EU|Greek;Turkish|1300|1
CZ|CZE|Czechia|Prague|EU|Czech|10900|1
DE|DEU|Germany|Berlin|EU|German|84500|1
DJ|DJI|Djibouti|Djibouti|AF|Arabic;French|1150|1
DK|DNK|Denmark|Copenhagen|EU|Danish|5950|1
DM|DMA|Dominica|Roseau|NA|English|72|1
DO|DOM|Dominican Republic|Santo Domingo|NA|Spanish|11300|1
DZ|DZA|Algeria|Algiers|AF|Arabic;Berber|46000|1
EC|ECU|Ecuador|Quito|SA|Spanish|18100|1
EE|EST|Estonia|Tallinn|EU|Estonian|1370|1
EG|EGY|Egypt|Cairo|AF|Arabic|114000|1
EH|ESH|Western Sahara|El Aaiún|AF|Arabic;Spanish|590|0
ER|ERI|Eritrea|Asmara|AF|Tigrinya|3600|1
ES|ESP|Spain|Madrid|EU|Spanish|48600|1
ET|ETH|Ethiopia|Addis Ababa|AF|Amharic|130000|1
FI|FIN|Finland|Helsinki|EU|Finnish;Swedish|5600|1
FJ|FJI|Fiji|Suva|OC|English;Fijian;Fiji Hindi|930|1
FK|FLK|Falkland Islands|Stanley|SA|English|4|0
FM|FSM|Micronesia|Palikir|OC|English|115|1
FO|FRO|Faroe Islands|Tórshavn|EU|Faroese;Danish|54|0
FR|FRA|France|Paris|EU|French|68400|1
GA|GAB|Gabon|Libreville|AF|French|2500|1
GB|GBR|United Kingdom|London|EU|English|69000|1
GD|GRD|Grenada|St. George's|NA|English|126|1
GE|GEO|Georgia|Tbilisi|AS|Georgian|3700|1
GF|GUF|French Guiana|Cayenne|SA|French|295|0
GG|GGY|Guernsey|St. Peter Port|EU|English;French|64|0
GH|GHA|Ghana|Accra|AF|English|34100|1
GI|GIB|Gibraltar|Gibraltar|EU|English|33|0
GL|GRL|Greenland|Nuuk|NA|Greenlandic|57|0
GM|GMB|Gambia|Banjul|AF|English|2800|1
GN|GIN|Guinea|Conakry|AF|French|14200|1
GP|GLP|Guadeloupe|Basse-Terre|NA|French|380|0
GQ|GNQ|Equatorial Guinea|Malabo|AF|Spanish;French;Portuguese|1800|1
GR|GRC|Greece|Athens|EU|Greek|10400|1
GS|SGS|South Georgia|King Edward Point|AN|English|0|0
GT|GTM|Guatemala|Guatemala City|NA|Spanish|18000|1
GU|GUM|Guam|Hagåtña|OC|English;Chamorro|170|0
GW|GNB|Guinea-Bissau|Bissau|AF|Portuguese|2200|1
GY|GUY|Guyana|Georgetown|SA|English|830|1
HK|HKG|Hong Kong|Hong Kong|AS|Chinese;English|7500|0
HM|HMD|Heard Island and McDonald Islands||AN||0|0
HN|HND|Honduras|Tegucigalpa|NA|Spanish|10600|1
HR|HRV|Croatia|Zagreb|EU|Croatian|3850|1
HT|HTI|Haiti|Port-au-Prince|NA|French;Haitian Creole|11700|1
HU|HUN|Hungary|Budapest|EU|Hungarian|9600|1
ID|IDN|Indonesia|Jakarta|AS|Indonesian|281000|1
IE|IRL|Ireland|Dublin|EU|Irish;English|5300|1
IL|ISR|Israel|Jerusalem|AS|Hebrew;Arabic|9900|1
IM|IMN|Isle of Man|Douglas|EU|English;Manx|84|0
IN|IND|India|New Delhi|AS|Hindi;English|1450000|1
IO|IOT|British Indian Ocean Territory|Diego Garcia|AF|English|0|0
IQ|IRQ|Iraq|Baghdad|AS|Arabic;Kurdish|46000|1
IR|IRN|Iran|Tehran|AS|Persian|90000|1
IS|ISL|Iceland|Reykjavik|EU|Icelandic|390|1
IT|ITA|Italy|Rome|EU|Italian|59000|1
JE|JEY|Jersey|Saint Helier|EU|English;French|104|0
JM|JAM|Jamaica|Kingston|NA|English|2800|1
JO|JOR|Jordan|Amman|AS|Arabic|11500|1
JP|JPN|Japan|Tokyo|AS|Japanese|123000|1
KE|KEN|Kenya|Nairobi|AF|English;Swahili|56000|1
KG|KGZ|Kyrgyzstan|Bishkek|AS|Kyrgyz;Russian|7200|1
KH|KHM|Cambodia|Phnom Penh|AS|Khmer|17000|1
KI|KIR|Kiribati|South Tarawa|OC|English|135|1
KM|COM|Comoros|Moroni|AF|Comorian;Arabic;French|850|1
KN|KNA|Saint Kitts and Nevis|Basseterre|NA|English|48|1
KP|PRK|North Korea|Pyongyang|AS|Korean|26500|1
KR|KOR|South Korea|Seoul|AS|Korean|51700|1
KW|KWT|Kuwait|Kuwait City|AS|Arabic|4900|1
KY|CYM|Cayman Islands|George Town|NA|English|70|0
KZ|KAZ|Kazakhstan|Astana|AS|Kazakh;Russian|20000|1
LA|LAO|Laos|Vientiane|AS|Lao|7700|1
LB|LBN|Lebanon|Beirut|AS|Arabic|5300|1
LC|LCA|Saint Lucia|Castries|NA|English|180|1
LI|LIE|Liechtenstein|Vaduz|EU|German|40|1
LK|LKA|Sri Lanka|Sri Jayawardenepura Kotte|AS|Sinhala;Tamil|22000|1
LR|LBR|Liberia|Monrovia|AF|English|5400|1
LS|LSO|Lesotho|Maseru|AF|English;Sotho|2300|1
LT|LTU|Lithuania|Vilnius|EU|Lithuanian|2900|1
LU|LUX|Luxembourg|Luxembourg|EU|French;German;Luxembourgish|670|1
LV|LVA|Latvia|Riga|EU|Latvian|1880|1
LY|LBY|Libya|Tripoli|AF|Arabic|7400|1
MA|MAR|Morocco|Rabat|AF|Arabic;Berber|37800|1
MC|MCO|Monaco|Monaco|EU|French|39|1
MD|MDA|Moldova|Chișinău|EU|Romanian|2400|1
ME|MNE|Montenegro|Podgorica|EU|Montenegrin|620|1
MF|MAF|Saint Martin|Marigot|NA|French|32|0
MG|MDG|Madagascar|Antananarivo|AF|French;Malagasy|31000|1
MH|MHL|Marshall Islands|Majuro|OC|English;Marshallese|38|1
MK|MKD|North Macedonia|Skopje|EU|Macedonian;Albanian|1830|1
ML|MLI|Mali|Bamako|AF|French|23300|1
MM|MMR|Myanmar|Naypyidaw|AS|Burmese|54500|1
MN|MNG|Mongolia|Ulaanbaatar|AS|Mongolian|3500|1
MO|MAC|Macau|Macau|AS|Chinese;Portuguese|690|0
MP|MNP|Northern Mariana Islands|Saipan|OC|English;Chamorro;Carolinian|48|0
MQ|MTQ|Martinique|Fort-de-France|NA|French|360|0
MR|MRT|Mauritania|Nouakchott|AF|Arabic|5000|1
MS|MSR|Montserrat|Plymouth|NA|English|4|0
MT|MLT|Malta|Valletta|EU|Maltese;English|540|1
MU|MUS|Mauritius|Port Louis|AF|English|1260|1
MV|MDV|Maldives|Malé|AS|Maldivian|520|1
MW|MWI|Malawi|Lilongwe|AF|English;Chewa|21000|1
MX|MEX|Mexico|Mexico City|NA|Spanish|130000|1
MY|MYS|Malaysia|Kuala Lumpur|AS|Malay|34000|1
MZ|MOZ|Mozambique|Maputo|AF|Portuguese|34000|1
NA|NAM|Namibia|Windhoek|AF|English|3100|1
NC|NCL|New Caledonia|Nouméa|OC|French|270|0
NE|NER|Niger|Niamey|AF|French|27000|1
NF|NFK|Norfolk Island|Kingston|OC|English|2|0
NG|NGA|Nigeria|Abuja|AF|English|227000|1
NI|NIC|Nicaragua|Managua|NA|Spanish|7000|1
NL|NLD|Netherlands|Amsterdam|EU|Dutch|17900|1
NO|NOR|Norway|Oslo|EU|Norwegian|5500|1
NP|NPL|Nepal|Kathmandu|AS|Nepali|30500|1
NR|NRU|Nauru|Yaren|OC|English;Nauruan|12|1
NU|NIU|Niue|Alofi|OC|English|2|0
NZ|NZL|New Zealand|Wellington|OC|English;Māori|5300|1
OM|OMN|Oman|Muscat|AS|Arabic|5300|1
PA|PAN|Panama|Panama City|NA|Spanish|4500|1
PE|PER|Peru|Lima|SA|Spanish;Quechua;Aymara|34000|1
PF|PYF|French Polynesia|Papeetē|OC|French|280|0
PG|PNG|Papua New Guinea|Port Moresby|OC|English;Tok Pisin;Hiri Motu|10300|1
PH|PHL|Philippines|Manila|AS|Filipino;English|115000|1
PK|PAK|Pakistan|Islamabad|AS|English;Urdu|245000|1
PL|POL|Poland|Warsaw|EU|Polish|36600|1
PM|SPM|Saint Pierre and Miquelon|Saint-Pierre|NA|French|6|0
PN|PCN|Pitcairn Islands|Adamstown|OC|English|0|0
PR|PRI|Puerto Rico|San Juan|NA|Spanish;English|3200|0
PT|PRT|Portugal|Lisbon|EU|Portuguese|10400|1
PW|PLW|Palau|Ngerulmud|OC|English;Palauan|18|1
PY|PRY|Paraguay|Asunción|SA|Spanish;Guaraní|6900|1
QA|QAT|Qatar|Doha|AS|Arabic|3000|1
RE|REU|Réunion|Saint-Denis|AF|French|880|0
RO|ROU|Romania|Bucharest|EU|Romanian|19000|1
RS|SRB|Serbia|Belgrade|EU|Serbian|6600|1
RU|RUS|Russia|Moscow|EU|Russian|144000|1
RW|RWA|Rwanda|Kigali|AF|English;French;Kinyarwanda|14100|1
SA|SAU|Saudi Arabia|Riyadh|AS|Arabic|36000|1
SB|SLB|Solomon Islands|Honiara|OC|English|740|1
SC|SYC|Seychelles|Victoria|AF|English;French;Seychellois Creole|108|1
SD|SDN|Sudan|Khartoum|AF|Arabic;English|49000|1
SE|SWE|Sweden|Stockholm|EU|Swedish|10600|1
SG|SGP|Singapore|Singapore|AS|English;Malay;Chinese;Tamil|5900|1
SH|SHN|Saint Helena, Ascension and Tristan da Cunha|Jamestown|AF|English|5|0
SI|SVN|Slovenia|Ljubljana|EU|Slovene|2120|1
SJ|SJM|Svalbard and Jan Mayen|Longyearbyen|EU|Norwegian|3|0
SK|SVK|Slovakia|Bratislava|EU|Slovak|5400|1
SL|SLE|Sierra Leone|Freetown|AF|English|8600|1
SM|SMR|San Marino|San Marino|EU|Italian|34|1
SN|SEN|Senegal|Dakar|AF|French|18000|1
SO|SOM|Somalia|Mogadishu|AF|Somali;Arabic|18100|1
SR|SUR|Suriname|Paramaribo|SA|Dutch|630|1
SS|SSD|South Sudan|Juba|AF|English|11900|1
ST|STP|São Tomé and Príncipe|São Tomé|AF|Portuguese|232|1
SV|SLV|El Salvador|San Salvador|NA|Spanish|6300|1
SX|SXM|Sint Maarten|Philipsburg|NA|Dutch;English|42|0
SY|SYR|Syria|Damascus|AS|Arabic|24000|1
SZ|SWZ|Eswatini|Mbabane|AF|English;Swazi|1200|1
TC|TCA|Turks and Caicos Islands|Cockburn Town|NA|English|46|0
TD|TCD|Chad|N'Djamena|AF|French;Arabic|19000|1
TF|ATF|French Southern and Antarctic Lands|Port-aux-Français|AN|French|0|0
TG|TGO|Togo|Lomé|AF|French|9500|1
TH|THA|Thailand|Bangkok|AS|Thai|71700|1
TJ|TJK|Tajikistan|Dushanbe|AS|Tajik|10300|1
TK|TKL|Tokelau|Fakaofo|OC|English;Tokelauan;Samoan|2|0
TL|TLS|Timor-Leste|Dili|AS|Portuguese;Tetum|1400|1
TM|TKM|Turkmenistan|Ashgabat|AS|Turkmen|7500|1
TN|TUN|Tunisia|Tunis|AF|Arabic|12000|1
TO|TON|Tonga|Nuku'alofa|OC|English;Tongan|100|1
TR|TUR|Turkey|Ankara|AS|Turkish|85500|1
TT|TTO|Trinidad and Tobago|Port of Spain|NA|English|1370|1
TV|TUV|Tuvalu|Funafuti|OC|English;Tuvaluan|11|1
TW|TWN|Taiwan|Taipei|AS|Chinese|23400|1
TZ|TZA|Tanzania|Dodoma|AF|English;Swahili|68000|1
UA|UKR|Ukraine|Kyiv|EU|Ukrainian|37000|1
UG|UGA|Uganda|Kampala|AF|English;Swahili|49000|1
UM|UMI|United States Minor Outlying Islands|Washington, D.C.|OC|English|0|0
US|USA|United States|Washington, D.C.|NA|English|340000|1
UY|URY|Uruguay|Montevideo|SA|Spanish|3400|1
UZ|UZB|Uzbekistan|Tashkent|AS|Uzbek|36000|1
VA|VAT|Vatican City|Vatican City|EU|Italian;Latin|1|1
VC|VCT|Saint Vincent and the Grenadines|Kingstown|NA|English|103|1
VE|VEN|Venezuela|Caracas|SA|Spanish|28500|1
VG|VGB|British Virgin Islands|Road Town|NA|English|32|0
VI|VIR|United States Virgin Islands|Charlotte Amalie|NA|English|87|0
VN|VNM|Vietnam|Hanoi|AS|Vietnamese|101000|1
VU|VUT|Vanuatu|Port Vila|OC|Bislama;English;French|330|1
WF|WLF|Wallis and Futuna|Mata-Utu|OC|French|11|0
WS|WSM|Samoa|Apia|OC|Samoan;English|220|1
YE|YEM|Yemen|Sana'a|AS|Arabic|35000|1
YT|MYT|Mayotte|Mamoudzou|AF|French|330|0
ZA|ZAF|South Africa|Pretoria|AF|Afrikaans;English;Southern Ndebele;Northern Sotho;Sotho;Swazi;Tsonga;Tswana;Venda;Xhosa;Zulu|63000|1
ZM|ZMB|Zambia|Lusaka|AF|English|21000|1
ZW|ZWE|Zimbabwe|Harare|AF|English;Shona;Ndebele;Chewa;Sotho;Tswana;Venda;Xhosa|16700|1
`;

/* ---- Expertise tiers: how many of the most familiar countries each level uses ---- */
const EXPERTISE_LIMITS={novice:70,intermediate:120,pro:180,expert:Infinity};
// Curated for general-audience familiarity. Tiers are cumulative, and all remaining ISO entries are appended for Expert.
const FAMILIARITY_CORE=`US GB FR DE IT ES CA AU JP CN IN BR RU MX KR TR EG ZA AR NL CH SE NO DK PL GR PT IE NZ TH IL SA AE ID VN PH MY SG UA AT BE FI CZ RO HU CL CO PE MA DZ NG KE ET GH TN PK BD IR IQ QA KW JO LB IS HR RS BG SK SI LT LV EE GE AM AZ KZ UZ NP LK MM KH MN TW CU JM DO CR PA UY PY BO EC VE GT HN SV NI PR TT BS BB CY LU MT MC VA SM LI AD AL BA ME MK MD BY XK SY YE OM BH BT BN TL MV MU SC MG TZ UG RW SN CI CM CD CG AO ZM ZW MZ NA BW LS SZ MW SD SS LY SO DJ ER TG BJ BF ML NE MR GM GN GW SL LR GA GQ CF TD BI KM CV ST`.split(/\s+/);
