-- Seed 172 prospects from build-crm.ts
INSERT INTO public.crm_prospects (priority, name, area, phone, email, website, stage, comments) VALUES
-- === TOP PRIORITY - CONSTRUCTION / TRADES SPECIALISTS ===
('top', 'Accountants for Tradesmen', 'National', '087 918 8907', 'info@gbsco.ie', 'accountantsfortradesmen.ie', 'new_lead', 'Sole focus on tradespeople. RCT, subcontractors. From €590. PERFECT fit.'),
('top', 'FORTI Accountants', 'Dublin 10', '01 906 5862', '', 'forti.ie', 'new_lead', 'Specialist accounting for Irish tradesmen. Builders, plumbers, electricians. Fixed-fee.'),
('top', 'Taxplus Accountants', 'Drogheda', '041 984 4525', 'info@taxplusaccountants.ie', 'taxplusaccountants.ie', 'new_lead', 'Explicitly serves carpenters, plumbers, electricians, construction. Open Sat/Sun.'),
('top', 'DBASS Chartered Accountants', 'Ashbourne, Meath', '01 849 8800', 'info@dbass.ie', 'dbass.ie', 'new_lead', 'Construction sector expertise. Serves Meath, Louth, Dublin.'),
('top', 'Kilkenny Accounting Services', 'Kilkenny', '087 776 7057', 'diana@kas.ie', 'kilkennyaccountingservices.ie', 'new_lead', 'Construction, retail, hospitality clients since 2006.'),

-- === HIGH PRIORITY - CONSTRUCTION CLIENTS OR TECH-FORWARD ===
('high', 'McDonough Hawkins & Co', 'Galway', '091 567798', 'info@mcdh.ie', 'mcdh.ie', 'new_lead', 'Trades, construction clients. 9 professionals. Since 1969.'),
('high', 'AccountantLimerick.ie', 'Limerick', '061 125896', '', 'accountantlimerick.ie', 'new_lead', 'Construction industry focus. Cloud accounting.'),
('high', 'Martin Quigley & Co', 'Wexford', '053 914 4270', 'info@martinquigley.ie', 'martinquigley.ie', 'new_lead', 'Construction, manufacturing, hotels. 30+ years.'),
('high', 'Twohig & Co', 'Cork (Douglas)', '021 489 5200', '', 'twohigaccountants.ie', 'new_lead', '23+ years contractor specialist. Fixed fees.'),
('high', 'GKS (Gannon Kirwan Somerville)', 'Blackrock, Dublin', '01 284 2544', 'post@gks.ie', 'gks.ie', 'new_lead', 'Contractors across IT, engineering, construction.'),
('high', 'RDA Accountants', 'Wexford/Kilkenny/Waterford/Dublin', '053 917 0507', '', 'rda.ie', 'new_lead', 'Xero Digital Practice Champion 2024. 5 offices. Tech-forward.'),
('high', 'Incorpro Limited', 'Athlone', '090 661 6893', 'info@incorpro.ie', 'incorpro.ie', 'new_lead', 'Small Practice of the Year 2025. Irish SMEs.'),
('high', 'Candor Chartered Accountants', 'Galway', '091 758 282', '', 'candor.ie', 'new_lead', 'Founded 2017. Uses Xero & QuickBooks cloud. Startups focus.'),
('high', 'Coffey & Co', 'Limerick', '', '', 'coffeyandco.ie', 'new_lead', '35+ years. Contractors, sole traders, publicans, retailers.'),

-- === EXISTING LIST - DUBLIN 15 / NORTH DUBLIN ===
('high', 'A.C.S. Ltd', 'Clonsilla, D15', '01 820 4483', '', '', 'contacted', 'Said yes after 24th Nov. OVERDUE - ring now.'),
('high', 'Bond & Co', 'Swords', '01 840 9173', 'info@bondandco.ie', 'bondandco.ie', 'contacted', 'John Bond - call back in Dec. OVERDUE.'),
('high', 'A.A. Accounting', 'Drumcondra, D9', '01 833 322 100', '', '', 'contacted', 'ABID - call 1pm 1st Dec. OVERDUE.'),
('high', 'Byrne D.F. & Associates', 'Pembroke Pl, D2', '01 662 4900', '', '', 'contacted', 'Ring back Dec. Michael (employee). OVERDUE.'),
('high', 'Kenna & Co', 'Blanch, D15', '01 822 4720', 'info@kennaaccountants.ie', 'Facebook', 'contacted', 'Passing email to manager. Follow up - did manager get it?'),
('medium', 'DSK Accountants', 'Castleknock, D15', '01 839 4265', '', 'dsk.ie', 'contacted', 'No answer previously.'),
('medium', 'MSH Accountants', 'Castleknock, D15', '01 820 6008', 'info@mshaccountants.ie', 'mshaccountants.ie', 'contacted', 'No answer previously.'),
('medium', 'TASC Accountants', 'Ongar, D15', '087 225 7706', 'info@tascaccountants.com', 'tascaccountants.com', 'contacted', 'Voicemail previously.'),
('medium', 'Abacus Accounting', 'D15', '01 811 9504', '', '', 'contacted', 'No answer previously.'),
('medium', 'A Plus Accounting', 'D15', '01 285 1998', '', '', 'contacted', 'No answer previously.'),
('medium', 'AMBA Tax', 'Swords', '01 908 1536', 'info@ambatax.ie', 'ambatax.ie', 'contacted', 'No answer previously.'),
('medium', 'Taxability', 'Swords', '01 842 4679', 'info@taxability.ie', 'taxability.ie', 'new_lead', ''),
('medium', 'Malone & Co', 'Ballycoolin, D11', '01 851 2941', 'info@malone.ie', 'malone.ie', 'new_lead', ''),
('medium', 'Icon Accounting', 'Swords', '01 807 7106', 'info@iconaccounting.ie', 'iconaccounting.ie', 'new_lead', ''),

-- === DUBLIN CITY / SOUTH DUBLIN ===
('medium', 'Accountable', 'Mount St, D2', '01 676 1777', 'david@accountable.ie', 'accountable.ie', 'contacted', 'No answer previously.'),
('medium', 'Accounts Advice Centre', 'O''Connell St, D1', '01 872 8561', 'queries@accountsadvicecentre.ie', 'accountsadvicecentre.ie', 'new_lead', 'Est 1996. Tax advisory specialists. Sole traders, partnerships, SMEs.'),
('medium', 'Dublin Accountancy', 'Camden St, D2', '01 697 2554', 'info@dublinaccountancy.ie', 'dublinaccountancy.ie', 'new_lead', ''),
('medium', 'Dublin Tax Advisers', 'D2', '087 785 5784', 'info@dublintaxadvisers.ie', 'dublintaxadvisers.ie', 'new_lead', '25+ years. Sole traders and SMEs.'),
('medium', 'Everyday Accountancy', 'Adelaide Rd, D2', '087 249 5856', 'info@everydayaccountancy.ie', 'everydayaccountancy.ie', 'new_lead', ''),
('medium', 'Karl McDonald & Co', 'Belvedere, D1', '01 855 4188', 'info@karlmcdonald.ie', 'karlmcdonald.ie', 'new_lead', ''),
('medium', 'Lorraine Whyte Accountants', 'Clontarf, D3', '01 968 0660', 'info@lwaccountants.ie', 'lwaccountants.ie', 'new_lead', ''),
('medium', 'Martin J. Kelly & Co', 'North Strand, D3', '01 855 5051', '', '', 'new_lead', ''),
('medium', 'OCMC Accountants', 'Drumcondra, D9', '01 836 9385', 'info@ocmc.ie', 'ocmc.ie', 'new_lead', ''),
('medium', 'Francis Brophy & Co', 'Fairview, D3', '01 853 0333', 'info@francisbrophy.ie', 'francisbrophy.ie', 'new_lead', ''),
('medium', 'Guardian Accounting', 'Rathfarnham, D16', '01 424 0519', 'CWhelan@guardianma.ie', 'guardianaccountants.ie', 'new_lead', ''),
('medium', 'Griffin & Associates', 'Rathfarnham, D14', '01 555 7325', '', '', 'new_lead', ''),
('medium', 'TaxAssist Camden St', 'D2', '01 407 0658', 'camdenstreet@taxassist.ie', 'taxassist.ie', 'new_lead', 'Franchise. Small business specialist.'),
('medium', 'TaxAssist Walkinstown', 'D12', '01 492 3588', 'walkinstown@taxassist.ie', 'taxassist.ie', 'new_lead', 'Franchise. Small business specialist.'),
('medium', 'McCarthy Walsh', 'Fitzwilliam Sq, D2', '01 444 5260', 'info@mccarthywalsh.ie', 'mccarthywalsh.ie', 'new_lead', ''),
('medium', 'McFeely & McKiernan', 'Ballymount, D12', '01 456 5649', 'info@mcfmck.ie', 'mcfmck.ie', 'new_lead', ''),
('medium', 'Capitax', 'City Quay, D2', '01 885 0500', 'info@capitax.ie', 'capitax.ie', 'new_lead', ''),
('medium', 'SVCO Consultancy', 'Harcourt St, D2', '01 963 8279', 'info@svco.ie', 'svco.ie', 'new_lead', ''),
('medium', 'TAS Consulting', 'Naas Rd, D12', '01 556 3253', 'moh@tasconsulting.ie', 'tasconsulting.ie', 'new_lead', ''),
('medium', 'VP Lynch & Co', 'Ballymount, D24', '01 490 1082', 'info@vplynch.ie', 'vplynch.ie', 'new_lead', ''),
('medium', 'Veldon Tait', 'Dun Laoghaire', '01 236 0651', 'info@veldon-tait.com', 'veldon-tait.com', 'new_lead', ''),
('medium', 'John Mulderrig & Co', 'Rathfarnham, D14', '01 492 9913', 'info@johnmulderrigandco.com', 'johnmulderrigandco.com', 'new_lead', ''),
('medium', 'JP O''Donohoe & Co', 'Newmarket, D8', '01 416 9660', 'info@jpod.ie', 'jpod.ie', 'new_lead', ''),
('medium', 'James Coyle & Co', 'Donnybrook, D4', '086 251 2523', 'info@jamescoyleandco.ie', 'jamescoyleandco.ie', 'new_lead', ''),
('medium', 'MJD Accountants', 'Clanwilliam Sq, D2', '01 903 8276', '', '', 'new_lead', ''),
('medium', 'MAC Accountancy (MACS)', 'Fitzwilliam St, D2', '01 662 0120', 'info@macs.ie', 'macs.ie', 'new_lead', ''),
('medium', 'Robert J. Kidney & Co', 'Windsor Pl, D2', '01 668 4411', 'info@rjkidney.com', 'rjkidney.com', 'new_lead', ''),
('medium', 'Dillon Kelly Cregan', 'Upper Mount St, D2', '01 676 2791', 'info@dillonkellycregan.ie', 'dillonkellycregan.ie', 'new_lead', ''),
('low', 'Brian Hogan & Co', 'Shankill', '01 282 1414', '', '', 'new_lead', ''),
('low', 'Butler J.M. & Co', 'Blackrock', '01 288 0437', '', '', 'new_lead', ''),
('low', 'Flynn M. & Co', 'Balbriggan', '01 841 3071', '', '', 'new_lead', ''),
('low', 'Hunt Raymond A. & Co', 'Rathmines, D6', '01 497 2494', '', '', 'new_lead', ''),
('low', 'Accountancy Focus', 'D14', '01 296 4087', '', '', 'new_lead', ''),
('low', 'John P. Burke & Co', 'Leixlip', '01 621 7410', 'info@johnpburke.ie', 'johnpburke.ie', 'new_lead', ''),

-- === COMMUTER BELT - LOUTH / MEATH ===
('medium', 'McEvoy Craig', 'Drogheda', '041 981 0160', 'gail@mcevoycraig.ie', 'mcevoycraig.ie', 'new_lead', 'Leading NE practice since 1999. 9 staff, 5 qualified.'),
('medium', 'Doyle Kelly & Co', 'Drogheda', '041 983 2331', '', 'accountantdrogheda.com', 'new_lead', 'Sole traders, startups, partnerships.'),
('medium', 'Murphy & Co', 'Drogheda', '041 983 1771', 'patricia@murphyandco.ie', 'murphyandco.ie', 'new_lead', 'CPA. Since 2003.'),
('medium', 'Berrill Kiernan & Associates', 'Drogheda', '041 983 7330', 'info@bkg.ie', 'bkg.ie', 'new_lead', 'Est 1964. 30 mins from Dublin Airport.'),
('medium', 'CMF Accountants', 'Dundalk', '042 933 4224', 'info@cmf.ie', 'cmf.ie', 'new_lead', ''),
('medium', 'Frank Lynch & Co', 'Dundalk / Balbriggan', '042 933 2273', 'info@flc.ie', 'flc.ie', 'new_lead', '50+ years. 2 offices.'),
('medium', 'O''Connor Martin & Co', 'Dundalk', '', '', 'oconnormartin.ie', 'new_lead', ''),
('medium', 'Greally Accountants', 'Navan', '', '', 'greallyaccountants.ie', 'new_lead', 'FCCA, Chartered Tax Advisor. SMEs.'),
('medium', 'BMS Accountants', 'Navan', '046 907 3868', 'info@bmsaccountants.ie', 'bmsaccountants.ie', 'new_lead', '95% retention. Sage Cloud. Tech-forward.'),
('medium', 'Clarke Corrigan & Co', 'Navan', '046 902 8177', '', 'ccandco.ie', 'new_lead', '2 partners, 7 employees.'),
('medium', 'Farrelly & Scully', 'Navan / Kildare / Cavan', '046 902 3934', 'info@farrellyscully.com', 'farrellyscully.com', 'new_lead', '40+ years. 3 offices.'),
('medium', 'Crowley & Co', 'Navan', '', '', 'crowleyaccountants.com', 'new_lead', 'Meath and North Dublin.'),

-- === KILDARE ===
('medium', 'Conway, Conway & Co', 'Naas', '045 879278', 'info@conwayco.ie', 'conwayco.ie', 'new_lead', 'Family-run since 1975. 5 partners.'),
('medium', 'The Leinster Partnership', 'Naas', '045 901 900', 'info@leinsterptnrs.ie', 'leinsterptnrs.ie', 'new_lead', '50+ years.'),
('medium', 'K M Coleman & Co', 'Maynooth', '01 601 6930', 'info@kmcolemanacc.com', 'kmcolemanacc.com', 'new_lead', 'ACCA auditors. Kildare, Dublin, Meath.'),
('medium', 'J McEvoy & Company', 'Celbridge', '01 627 3590', 'info@mcevoy.ie', 'mcevoy.ie', 'new_lead', '20+ years. Free initial consultation.'),
('medium', 'Kevin Mannion & Co', 'Maynooth', '01 601 2804', 'info@kevinmannion.ie', 'kevinmannion.ie', 'new_lead', 'Fellow of CAI.'),

-- === GALWAY ===
('medium', 'Keogh Accountancy Group', 'Galway', '091 778 690', 'info@accountancygalway.com', 'accountancygalway.com', 'new_lead', 'Est 1980s. FCCA directors.'),
('medium', 'Bradan Accountants', 'Galway', '091 450 705', '', 'bradanaccountants.ie', 'new_lead', ''),
('medium', 'Finan O''Beirn & Co', 'Galway', '091 778 899', 'info@finanobeirn.ie', 'finanobeirn.ie', 'new_lead', 'Est 1992. Bookkeeping, VAT, payroll.'),
('medium', 'TaxAssist Galway', 'Galway', '', '', 'taxassist.ie', 'new_lead', 'Franchise. Small business specialist.'),

-- === CORK ===
('medium', 'Curran & Co', 'Cork', '021 431 7474', 'admin@curranco.ie', 'curranco.ie', 'new_lead', 'Independent. Est 1987. SMEs.'),
('medium', 'AG Associates', 'Cork (Little Island)', '021 482 4723', 'info@agassociates.ie', 'agassociates.ie', 'new_lead', 'Software implementation & training. Tech-forward.'),
('medium', 'Frances Hegarty & Co', 'Cork (Glanmire)', '021 455 6960', 'ncraig@fhegarty.com', 'fhegarty.com', 'new_lead', 'Est 2009. SMEs, sole traders, family businesses.'),
('medium', 'TaxAssist Cork', 'Cork', '', '', 'taxassist.ie', 'new_lead', 'Franchise. Small business specialist.'),

-- === LIMERICK ===
('medium', 'O''Donnell + Co', 'Limerick', '061 317500', 'info@odonnellaccountants.ie', 'odonnellaccountants.ie', 'new_lead', 'Since 1997. Outsourced accounting, payroll.'),
('medium', 'Moloney O''Neill', 'Limerick', '061 316468', 'emmett@moloneyoneill.ie', 'moloneyoneill.ie', 'new_lead', ''),
('medium', 'Fitzpatrick Donnellan', 'Limerick', '061 310277', 'info@fitzpatrickdonnellan.ie', 'fitzpatrickdonnellan.ie', 'new_lead', ''),
('medium', 'MOET Accountants', 'Limerick (Castletroy)', '061 335574', 'info@moet.ie', 'moet.ie', 'new_lead', '4 partners, 100+ years combined. Munster.'),
('medium', 'TaxAssist Limerick', 'Limerick', '', '', 'taxassist.ie', 'new_lead', 'Franchise.'),

-- === SOUTHEAST ===
('medium', 'Drohan & Knox', 'Waterford', '051 301770', 'info@drohanknox.ie', 'drohanknox.ie', 'new_lead', '40+ years. Retailers specialist.'),
('medium', 'Park Chambers', 'Waterford', '051 877965', '', 'parkchambers.com', 'new_lead', '40+ years. Sole traders, SMEs.'),
('medium', 'FDC / Mark Kennedy & Co', 'Waterford', '051 879277', 'fdcwaterford@fdc.ie', 'waterfordaccountants.ie', 'new_lead', '10 employees. Free initial consultation.'),
('medium', 'Daly Farrell', 'Kilkenny / Dublin', '056 775 6666', 'info@dalyfarrell.ie', 'dalyfarrell.ie', 'new_lead', ''),
('medium', 'Anthony Ryan Accountants', 'Enniscorthy, Wexford', '053 923 3968', 'info@aryanco.ie', 'aryanco.ie', 'new_lead', 'Award-winning. 20 staff. Free consultation.'),
('medium', 'IMC Accountants', 'Thomastown, Kilkenny', '086 855 5302', '', 'imcaccountants.ie', 'new_lead', 'Est 2010. Small firms & sole traders specialist.'),

-- === NATIONAL / OTHER ===
('medium', 'TRA Professional Services', 'Roscommon / Dublin', '01 524 2693', 'darena@tra-professional.ie', 'tra-professional.ie', 'new_lead', 'Contract workers. Fixed pricing.');
