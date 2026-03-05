import ExcelJS from "exceljs";

const workbook = new ExcelJS.Workbook();
const ws = workbook.addWorksheet("Outreach CRM", {
  views: [{ state: "frozen", ySplit: 1 }],
});

// Columns
ws.columns = [
  { header: "Priority", key: "priority", width: 12 },
  { header: "Practice Name", key: "name", width: 35 },
  { header: "Area", key: "area", width: 25 },
  { header: "Phone", key: "phone", width: 18 },
  { header: "Email", key: "email", width: 32 },
  { header: "Website", key: "website", width: 30 },
  { header: "Stage", key: "stage", width: 16 },
  { header: "Call 1 Date", key: "call1", width: 14 },
  { header: "Call 1 Notes", key: "call1notes", width: 35 },
  { header: "Demo Date", key: "demo", width: 14 },
  { header: "Demo Notes", key: "demonotes", width: 35 },
  { header: "Call 2 Date", key: "call2", width: 14 },
  { header: "Call 2 Notes", key: "call2notes", width: 35 },
  { header: "Pilot Started", key: "pilot", width: 14 },
  { header: "Closed", key: "closed", width: 14 },
  { header: "Deal Value", key: "value", width: 14 },
  { header: "Comments", key: "comments", width: 50 },
];

// Header styling
const headerRow = ws.getRow(1);
headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A1A2E" } };
headerRow.alignment = { horizontal: "center", vertical: "middle" };
headerRow.height = 25;

// Stage dropdown values
const stageOptions = '"New Lead,Contacted,Call 1 Booked,Call 1 Done,Demo Booked,Demo Done,Call 2 Booked,Call 2 Done,Pilot,Closed Won,Closed Lost,Not a Fit"';
const priorityOptions = '"TOP,HIGH,MEDIUM,LOW"';

type Prospect = {
  priority: string;
  name: string;
  area: string;
  phone: string;
  email: string;
  website: string;
  stage: string;
  comments: string;
};

const prospects: Prospect[] = [
  // === TOP PRIORITY - CONSTRUCTION / TRADES SPECIALISTS ===
  { priority: "TOP", name: "Accountants for Tradesmen", area: "National", phone: "087 918 8907", email: "info@gbsco.ie", website: "accountantsfortradesmen.ie", stage: "New Lead", comments: "Sole focus on tradespeople. RCT, subcontractors. From €590. PERFECT fit." },
  { priority: "TOP", name: "FORTI Accountants", area: "Dublin 10", phone: "01 906 5862", email: "", website: "forti.ie", stage: "New Lead", comments: "Specialist accounting for Irish tradesmen. Builders, plumbers, electricians. Fixed-fee." },
  { priority: "TOP", name: "Taxplus Accountants", area: "Drogheda", phone: "041 984 4525", email: "info@taxplusaccountants.ie", website: "taxplusaccountants.ie", stage: "New Lead", comments: "Explicitly serves carpenters, plumbers, electricians, construction. Open Sat/Sun." },
  { priority: "TOP", name: "DBASS Chartered Accountants", area: "Ashbourne, Meath", phone: "01 849 8800", email: "info@dbass.ie", website: "dbass.ie", stage: "New Lead", comments: "Construction sector expertise. Serves Meath, Louth, Dublin." },
  { priority: "TOP", name: "Kilkenny Accounting Services", area: "Kilkenny", phone: "087 776 7057", email: "diana@kas.ie", website: "kilkennyaccountingservices.ie", stage: "New Lead", comments: "Construction, retail, hospitality clients since 2006." },

  // === HIGH PRIORITY - CONSTRUCTION CLIENTS OR TECH-FORWARD ===
  { priority: "HIGH", name: "McDonough Hawkins & Co", area: "Galway", phone: "091 567798", email: "info@mcdh.ie", website: "mcdh.ie", stage: "New Lead", comments: "Trades, construction clients. 9 professionals. Since 1969." },
  { priority: "HIGH", name: "AccountantLimerick.ie", area: "Limerick", phone: "061 125896", email: "", website: "accountantlimerick.ie", stage: "New Lead", comments: "Construction industry focus. Cloud accounting." },
  { priority: "HIGH", name: "Martin Quigley & Co", area: "Wexford", phone: "053 914 4270", email: "info@martinquigley.ie", website: "martinquigley.ie", stage: "New Lead", comments: "Construction, manufacturing, hotels. 30+ years." },
  { priority: "HIGH", name: "Twohig & Co", area: "Cork (Douglas)", phone: "021 489 5200", email: "", website: "twohigaccountants.ie", stage: "New Lead", comments: "23+ years contractor specialist. Fixed fees." },
  { priority: "HIGH", name: "GKS (Gannon Kirwan Somerville)", area: "Blackrock, Dublin", phone: "01 284 2544", email: "post@gks.ie", website: "gks.ie", stage: "New Lead", comments: "Contractors across IT, engineering, construction." },
  { priority: "HIGH", name: "RDA Accountants", area: "Wexford/Kilkenny/Waterford/Dublin", phone: "053 917 0507", email: "", website: "rda.ie", stage: "New Lead", comments: "Xero Digital Practice Champion 2024. 5 offices. Tech-forward." },
  { priority: "HIGH", name: "Incorpro Limited", area: "Athlone", phone: "090 661 6893", email: "info@incorpro.ie", website: "incorpro.ie", stage: "New Lead", comments: "Small Practice of the Year 2025. Irish SMEs." },
  { priority: "HIGH", name: "Candor Chartered Accountants", area: "Galway", phone: "091 758 282", email: "", website: "candor.ie", stage: "New Lead", comments: "Founded 2017. Uses Xero & QuickBooks cloud. Startups focus." },
  { priority: "HIGH", name: "Coffey & Co", area: "Limerick", phone: "", email: "", website: "coffeyandco.ie", stage: "New Lead", comments: "35+ years. Contractors, sole traders, publicans, retailers." },

  // === EXISTING LIST - DUBLIN 15 / NORTH DUBLIN (YOUR PATCH) ===
  { priority: "HIGH", name: "A.C.S. Ltd", area: "Clonsilla, D15", phone: "01 820 4483", email: "", website: "", stage: "Contacted", comments: "Said yes after 24th Nov. OVERDUE - ring now." },
  { priority: "HIGH", name: "Bond & Co", area: "Swords", phone: "01 840 9173", email: "info@bondandco.ie", website: "bondandco.ie", stage: "Contacted", comments: "John Bond - call back in Dec. OVERDUE." },
  { priority: "HIGH", name: "A.A. Accounting", area: "Drumcondra, D9", phone: "01 833 322 100", email: "", website: "", stage: "Contacted", comments: "ABID - call 1pm 1st Dec. OVERDUE." },
  { priority: "HIGH", name: "Byrne D.F. & Associates", area: "Pembroke Pl, D2", phone: "01 662 4900", email: "", website: "", stage: "Contacted", comments: "Ring back Dec. Michael (employee). OVERDUE." },
  { priority: "HIGH", name: "Kenna & Co", area: "Blanch, D15", phone: "01 822 4720", email: "info@kennaaccountants.ie", website: "Facebook", stage: "Contacted", comments: "Passing email to manager. Follow up - did manager get it?" },
  { priority: "MEDIUM", name: "DSK Accountants", area: "Castleknock, D15", phone: "01 839 4265", email: "", website: "dsk.ie", stage: "Contacted", comments: "No answer previously." },
  { priority: "MEDIUM", name: "MSH Accountants", area: "Castleknock, D15", phone: "01 820 6008", email: "info@mshaccountants.ie", website: "mshaccountants.ie", stage: "Contacted", comments: "No answer previously." },
  { priority: "MEDIUM", name: "TASC Accountants", area: "Ongar, D15", phone: "087 225 7706", email: "info@tascaccountants.com", website: "tascaccountants.com", stage: "Contacted", comments: "Voicemail previously." },
  { priority: "MEDIUM", name: "Abacus Accounting", area: "D15", phone: "01 811 9504", email: "", website: "", stage: "Contacted", comments: "No answer previously." },
  { priority: "MEDIUM", name: "A Plus Accounting", area: "D15", phone: "01 285 1998", email: "", website: "", stage: "Contacted", comments: "No answer previously." },
  { priority: "MEDIUM", name: "AMBA Tax", area: "Swords", phone: "01 908 1536", email: "info@ambatax.ie", website: "ambatax.ie", stage: "Contacted", comments: "No answer previously." },
  { priority: "MEDIUM", name: "Taxability", area: "Swords", phone: "01 842 4679", email: "info@taxability.ie", website: "taxability.ie", stage: "New Lead", comments: "" },
  { priority: "MEDIUM", name: "Malone & Co", area: "Ballycoolin, D11", phone: "01 851 2941", email: "info@malone.ie", website: "malone.ie", stage: "New Lead", comments: "" },
  { priority: "MEDIUM", name: "Icon Accounting", area: "Swords", phone: "01 807 7106", email: "info@iconaccounting.ie", website: "iconaccounting.ie", stage: "New Lead", comments: "" },

  // === EXISTING LIST - DUBLIN CITY / SOUTH DUBLIN ===
  { priority: "MEDIUM", name: "Accountable", area: "Mount St, D2", phone: "01 676 1777", email: "david@accountable.ie", website: "accountable.ie", stage: "Contacted", comments: "No answer previously." },
  { priority: "MEDIUM", name: "Accounts Advice Centre", area: "O'Connell St, D1", phone: "01 872 8561", email: "queries@accountsadvicecentre.ie", website: "accountsadvicecentre.ie", stage: "New Lead", comments: "Est 1996. Tax advisory specialists. Sole traders, partnerships, SMEs." },
  { priority: "MEDIUM", name: "Dublin Accountancy", area: "Camden St, D2", phone: "01 697 2554", email: "info@dublinaccountancy.ie", website: "dublinaccountancy.ie", stage: "New Lead", comments: "" },
  { priority: "MEDIUM", name: "Dublin Tax Advisers", area: "D2", phone: "087 785 5784", email: "info@dublintaxadvisers.ie", website: "dublintaxadvisers.ie", stage: "New Lead", comments: "25+ years. Sole traders and SMEs." },
  { priority: "MEDIUM", name: "Everyday Accountancy", area: "Adelaide Rd, D2", phone: "087 249 5856", email: "info@everydayaccountancy.ie", website: "everydayaccountancy.ie", stage: "New Lead", comments: "" },
  { priority: "MEDIUM", name: "Karl McDonald & Co", area: "Belvedere, D1", phone: "01 855 4188", email: "info@karlmcdonald.ie", website: "karlmcdonald.ie", stage: "New Lead", comments: "" },
  { priority: "MEDIUM", name: "Lorraine Whyte Accountants", area: "Clontarf, D3", phone: "01 968 0660", email: "info@lwaccountants.ie", website: "lwaccountants.ie", stage: "New Lead", comments: "" },
  { priority: "MEDIUM", name: "Martin J. Kelly & Co", area: "North Strand, D3", phone: "01 855 5051", email: "", website: "", stage: "New Lead", comments: "" },
  { priority: "MEDIUM", name: "OCMC Accountants", area: "Drumcondra, D9", phone: "01 836 9385", email: "info@ocmc.ie", website: "ocmc.ie", stage: "New Lead", comments: "" },
  { priority: "MEDIUM", name: "Francis Brophy & Co", area: "Fairview, D3", phone: "01 853 0333", email: "info@francisbrophy.ie", website: "francisbrophy.ie", stage: "New Lead", comments: "" },
  { priority: "MEDIUM", name: "Guardian Accounting", area: "Rathfarnham, D16", phone: "01 424 0519", email: "CWhelan@guardianma.ie", website: "guardianaccountants.ie", stage: "New Lead", comments: "" },
  { priority: "MEDIUM", name: "Griffin & Associates", area: "Rathfarnham, D14", phone: "01 555 7325", email: "", website: "", stage: "New Lead", comments: "" },
  { priority: "MEDIUM", name: "TaxAssist Camden St", area: "D2", phone: "01 407 0658", email: "camdenstreet@taxassist.ie", website: "taxassist.ie", stage: "New Lead", comments: "Franchise. Small business specialist." },
  { priority: "MEDIUM", name: "TaxAssist Walkinstown", area: "D12", phone: "01 492 3588", email: "walkinstown@taxassist.ie", website: "taxassist.ie", stage: "New Lead", comments: "Franchise. Small business specialist." },
  { priority: "MEDIUM", name: "McCarthy Walsh", area: "Fitzwilliam Sq, D2", phone: "01 444 5260", email: "info@mccarthywalsh.ie", website: "mccarthywalsh.ie", stage: "New Lead", comments: "" },
  { priority: "MEDIUM", name: "McFeely & McKiernan", area: "Ballymount, D12", phone: "01 456 5649", email: "info@mcfmck.ie", website: "mcfmck.ie", stage: "New Lead", comments: "" },
  { priority: "MEDIUM", name: "Capitax", area: "City Quay, D2", phone: "01 885 0500", email: "info@capitax.ie", website: "capitax.ie", stage: "New Lead", comments: "" },
  { priority: "MEDIUM", name: "SVCO Consultancy", area: "Harcourt St, D2", phone: "01 963 8279", email: "info@svco.ie", website: "svco.ie", stage: "New Lead", comments: "" },
  { priority: "MEDIUM", name: "TAS Consulting", area: "Naas Rd, D12", phone: "01 556 3253", email: "moh@tasconsulting.ie", website: "tasconsulting.ie", stage: "New Lead", comments: "" },
  { priority: "MEDIUM", name: "VP Lynch & Co", area: "Ballymount, D24", phone: "01 490 1082", email: "info@vplynch.ie", website: "vplynch.ie", stage: "New Lead", comments: "" },
  { priority: "MEDIUM", name: "Veldon Tait", area: "Dun Laoghaire", phone: "01 236 0651", email: "info@veldon-tait.com", website: "veldon-tait.com", stage: "New Lead", comments: "" },
  { priority: "MEDIUM", name: "John Mulderrig & Co", area: "Rathfarnham, D14", phone: "01 492 9913", email: "info@johnmulderrigandco.com", website: "johnmulderrigandco.com", stage: "New Lead", comments: "" },
  { priority: "MEDIUM", name: "JP O'Donohoe & Co", area: "Newmarket, D8", phone: "01 416 9660", email: "info@jpod.ie", website: "jpod.ie", stage: "New Lead", comments: "" },
  { priority: "MEDIUM", name: "James Coyle & Co", area: "Donnybrook, D4", phone: "086 251 2523", email: "info@jamescoyleandco.ie", website: "jamescoyleandco.ie", stage: "New Lead", comments: "" },
  { priority: "MEDIUM", name: "MJD Accountants", area: "Clanwilliam Sq, D2", phone: "01 903 8276", email: "", website: "", stage: "New Lead", comments: "" },
  { priority: "MEDIUM", name: "MAC Accountancy (MACS)", area: "Fitzwilliam St, D2", phone: "01 662 0120", email: "info@macs.ie", website: "macs.ie", stage: "New Lead", comments: "" },
  { priority: "MEDIUM", name: "Robert J. Kidney & Co", area: "Windsor Pl, D2", phone: "01 668 4411", email: "info@rjkidney.com", website: "rjkidney.com", stage: "New Lead", comments: "" },
  { priority: "MEDIUM", name: "Dillon Kelly Cregan", area: "Upper Mount St, D2", phone: "01 676 2791", email: "info@dillonkellycregan.ie", website: "dillonkellycregan.ie", stage: "New Lead", comments: "" },
  { priority: "LOW", name: "Brian Hogan & Co", area: "Shankill", phone: "01 282 1414", email: "", website: "", stage: "New Lead", comments: "" },
  { priority: "LOW", name: "Butler J.M. & Co", area: "Blackrock", phone: "01 288 0437", email: "", website: "", stage: "New Lead", comments: "" },
  { priority: "LOW", name: "Flynn M. & Co", area: "Balbriggan", phone: "01 841 3071", email: "", website: "", stage: "New Lead", comments: "" },
  { priority: "LOW", name: "Hunt Raymond A. & Co", area: "Rathmines, D6", phone: "01 497 2494", email: "", website: "", stage: "New Lead", comments: "" },
  { priority: "LOW", name: "Accountancy Focus", area: "D14", phone: "01 296 4087", email: "", website: "", stage: "New Lead", comments: "" },
  { priority: "LOW", name: "John P. Burke & Co", area: "Leixlip", phone: "01 621 7410", email: "info@johnpburke.ie", website: "johnpburke.ie", stage: "New Lead", comments: "" },

  // === COMMUTER BELT - LOUTH / MEATH ===
  { priority: "MEDIUM", name: "McEvoy Craig", area: "Drogheda", phone: "041 981 0160", email: "gail@mcevoycraig.ie", website: "mcevoycraig.ie", stage: "New Lead", comments: "Leading NE practice since 1999. 9 staff, 5 qualified." },
  { priority: "MEDIUM", name: "Doyle Kelly & Co", area: "Drogheda", phone: "041 983 2331", email: "", website: "accountantdrogheda.com", stage: "New Lead", comments: "Sole traders, startups, partnerships." },
  { priority: "MEDIUM", name: "Murphy & Co", area: "Drogheda", phone: "041 983 1771", email: "patricia@murphyandco.ie", website: "murphyandco.ie", stage: "New Lead", comments: "CPA. Since 2003." },
  { priority: "MEDIUM", name: "Berrill Kiernan & Associates", area: "Drogheda", phone: "041 983 7330", email: "info@bkg.ie", website: "bkg.ie", stage: "New Lead", comments: "Est 1964. 30 mins from Dublin Airport." },
  { priority: "MEDIUM", name: "CMF Accountants", area: "Dundalk", phone: "042 933 4224", email: "info@cmf.ie", website: "cmf.ie", stage: "New Lead", comments: "" },
  { priority: "MEDIUM", name: "Frank Lynch & Co", area: "Dundalk / Balbriggan", phone: "042 933 2273", email: "info@flc.ie", website: "flc.ie", stage: "New Lead", comments: "50+ years. 2 offices." },
  { priority: "MEDIUM", name: "O'Connor Martin & Co", area: "Dundalk", phone: "", email: "", website: "oconnormartin.ie", stage: "New Lead", comments: "" },
  { priority: "MEDIUM", name: "Greally Accountants", area: "Navan", phone: "", email: "", website: "greallyaccountants.ie", stage: "New Lead", comments: "FCCA, Chartered Tax Advisor. SMEs." },
  { priority: "MEDIUM", name: "BMS Accountants", area: "Navan", phone: "046 907 3868", email: "info@bmsaccountants.ie", website: "bmsaccountants.ie", stage: "New Lead", comments: "95% retention. Sage Cloud. Tech-forward." },
  { priority: "MEDIUM", name: "Clarke Corrigan & Co", area: "Navan", phone: "046 902 8177", email: "", website: "ccandco.ie", stage: "New Lead", comments: "2 partners, 7 employees." },
  { priority: "MEDIUM", name: "Farrelly & Scully", area: "Navan / Kildare / Cavan", phone: "046 902 3934", email: "info@farrellyscully.com", website: "farrellyscully.com", stage: "New Lead", comments: "40+ years. 3 offices." },
  { priority: "MEDIUM", name: "Crowley & Co", area: "Navan", phone: "", email: "", website: "crowleyaccountants.com", stage: "New Lead", comments: "Meath and North Dublin." },

  // === KILDARE ===
  { priority: "MEDIUM", name: "Conway, Conway & Co", area: "Naas", phone: "045 879278", email: "info@conwayco.ie", website: "conwayco.ie", stage: "New Lead", comments: "Family-run since 1975. 5 partners." },
  { priority: "MEDIUM", name: "The Leinster Partnership", area: "Naas", phone: "045 901 900", email: "info@leinsterptnrs.ie", website: "leinsterptnrs.ie", stage: "New Lead", comments: "50+ years." },
  { priority: "MEDIUM", name: "K M Coleman & Co", area: "Maynooth", phone: "01 601 6930", email: "info@kmcolemanacc.com", website: "kmcolemanacc.com", stage: "New Lead", comments: "ACCA auditors. Kildare, Dublin, Meath." },
  { priority: "MEDIUM", name: "J McEvoy & Company", area: "Celbridge", phone: "01 627 3590", email: "info@mcevoy.ie", website: "mcevoy.ie", stage: "New Lead", comments: "20+ years. Free initial consultation." },
  { priority: "MEDIUM", name: "Kevin Mannion & Co", area: "Maynooth", phone: "01 601 2804", email: "info@kevinmannion.ie", website: "kevinmannion.ie", stage: "New Lead", comments: "Fellow of CAI." },

  // === GALWAY ===
  { priority: "MEDIUM", name: "Keogh Accountancy Group", area: "Galway", phone: "091 778 690", email: "info@accountancygalway.com", website: "accountancygalway.com", stage: "New Lead", comments: "Est 1980s. FCCA directors." },
  { priority: "MEDIUM", name: "Bradan Accountants", area: "Galway", phone: "091 450 705", email: "", website: "bradanaccountants.ie", stage: "New Lead", comments: "" },
  { priority: "MEDIUM", name: "Finan O'Beirn & Co", area: "Galway", phone: "091 778 899", email: "info@finanobeirn.ie", website: "finanobeirn.ie", stage: "New Lead", comments: "Est 1992. Bookkeeping, VAT, payroll." },
  { priority: "MEDIUM", name: "TaxAssist Galway", area: "Galway", phone: "", email: "", website: "taxassist.ie", stage: "New Lead", comments: "Franchise. Small business specialist." },

  // === CORK ===
  { priority: "MEDIUM", name: "Curran & Co", area: "Cork", phone: "021 431 7474", email: "admin@curranco.ie", website: "curranco.ie", stage: "New Lead", comments: "Independent. Est 1987. SMEs." },
  { priority: "MEDIUM", name: "AG Associates", area: "Cork (Little Island)", phone: "021 482 4723", email: "info@agassociates.ie", website: "agassociates.ie", stage: "New Lead", comments: "Software implementation & training. Tech-forward." },
  { priority: "MEDIUM", name: "Frances Hegarty & Co", area: "Cork (Glanmire)", phone: "021 455 6960", email: "ncraig@fhegarty.com", website: "fhegarty.com", stage: "New Lead", comments: "Est 2009. SMEs, sole traders, family businesses." },
  { priority: "MEDIUM", name: "TaxAssist Cork", area: "Cork", phone: "", email: "", website: "taxassist.ie", stage: "New Lead", comments: "Franchise. Small business specialist." },

  // === LIMERICK ===
  { priority: "MEDIUM", name: "O'Donnell + Co", area: "Limerick", phone: "061 317500", email: "info@odonnellaccountants.ie", website: "odonnellaccountants.ie", stage: "New Lead", comments: "Since 1997. Outsourced accounting, payroll." },
  { priority: "MEDIUM", name: "Moloney O'Neill", area: "Limerick", phone: "061 316468", email: "emmett@moloneyoneill.ie", website: "moloneyoneill.ie", stage: "New Lead", comments: "" },
  { priority: "MEDIUM", name: "Fitzpatrick Donnellan", area: "Limerick", phone: "061 310277", email: "info@fitzpatrickdonnellan.ie", website: "fitzpatrickdonnellan.ie", stage: "New Lead", comments: "" },
  { priority: "MEDIUM", name: "MOET Accountants", area: "Limerick (Castletroy)", phone: "061 335574", email: "info@moet.ie", website: "moet.ie", stage: "New Lead", comments: "4 partners, 100+ years combined. Munster." },
  { priority: "MEDIUM", name: "TaxAssist Limerick", area: "Limerick", phone: "", email: "", website: "taxassist.ie", stage: "New Lead", comments: "Franchise." },

  // === SOUTHEAST ===
  { priority: "MEDIUM", name: "Drohan & Knox", area: "Waterford", phone: "051 301770", email: "info@drohanknox.ie", website: "drohanknox.ie", stage: "New Lead", comments: "40+ years. Retailers specialist." },
  { priority: "MEDIUM", name: "Park Chambers", area: "Waterford", phone: "051 877965", email: "", website: "parkchambers.com", stage: "New Lead", comments: "40+ years. Sole traders, SMEs." },
  { priority: "MEDIUM", name: "FDC / Mark Kennedy & Co", area: "Waterford", phone: "051 879277", email: "fdcwaterford@fdc.ie", website: "waterfordaccountants.ie", stage: "New Lead", comments: "10 employees. Free initial consultation." },
  { priority: "MEDIUM", name: "Daly Farrell", area: "Kilkenny / Dublin", phone: "056 775 6666", email: "info@dalyfarrell.ie", website: "dalyfarrell.ie", stage: "New Lead", comments: "" },
  { priority: "MEDIUM", name: "Anthony Ryan Accountants", area: "Enniscorthy, Wexford", phone: "053 923 3968", email: "info@aryanco.ie", website: "aryanco.ie", stage: "New Lead", comments: "Award-winning. 20 staff. Free consultation." },
  { priority: "MEDIUM", name: "IMC Accountants", area: "Thomastown, Kilkenny", phone: "086 855 5302", email: "", website: "imcaccountants.ie", stage: "New Lead", comments: "Est 2010. Small firms & sole traders specialist." },

  // === NATIONAL / OTHER ===
  { priority: "MEDIUM", name: "TRA Professional Services", area: "Roscommon / Dublin", phone: "01 524 2693", email: "darena@tra-professional.ie", website: "tra-professional.ie", stage: "New Lead", comments: "Contract workers. Fixed pricing." },
];

// Add data rows
for (const p of prospects) {
  const row = ws.addRow({
    priority: p.priority,
    name: p.name,
    area: p.area,
    phone: p.phone,
    email: p.email,
    website: p.website,
    stage: p.stage,
    call1: "",
    call1notes: "",
    demo: "",
    demonotes: "",
    call2: "",
    call2notes: "",
    pilot: "",
    closed: "",
    value: "",
    comments: p.comments,
  });

  // Priority colour coding
  const priorityCell = row.getCell("priority");
  if (p.priority === "TOP") {
    priorityCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF4444" } };
    priorityCell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  } else if (p.priority === "HIGH") {
    priorityCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF8C00" } };
    priorityCell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  } else if (p.priority === "MEDIUM") {
    priorityCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4CAF50" } };
    priorityCell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  } else {
    priorityCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF9E9E9E" } };
    priorityCell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  }

  // Stage colour
  const stageCell = row.getCell("stage");
  if (p.stage === "Contacted") {
    stageCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3CD" } };
  } else if (p.stage === "New Lead") {
    stageCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE3F2FD" } };
  }
}

// Add data validation dropdowns for stage and priority columns
const lastRow = prospects.length + 1;
for (let i = 2; i <= lastRow; i++) {
  ws.getCell(`G${i}`).dataValidation = {
    type: "list",
    allowBlank: true,
    formulae: [stageOptions],
  };
  ws.getCell(`A${i}`).dataValidation = {
    type: "list",
    allowBlank: true,
    formulae: [priorityOptions],
  };
}

// Auto-filter
ws.autoFilter = { from: "A1", to: `Q${lastRow}` };

// Save
async function main() {
  await workbook.xlsx.writeFile("C:/Users/onejf/Desktop/balnce-crm-v2.xlsx");
  console.log(`Done. ${prospects.length} prospects. Saved to Desktop.`);
}
main().catch(console.error);
