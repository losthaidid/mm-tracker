/** Maintained reference presets. Factories return independent, editable draft lists. */
(function (root) {
  'use strict';
  // User-supplied MEINS codes: case, leading zeros and symbols are significant.
  // Markdown escapes are display syntax; 001 intentionally has no description.
  const units = `%	%
%O	%0
ONE	One
D	Days
22S	mm2/s
CMS	cm/s
000	m/min
µL	µl
µF	µF
PF	pF
A	A
GOH	GOhm
GM3	g/m3
ACR	Acre
KD3	kg/dm3
KML	kmol
NI	ND
MN	MN
MGO	MOhm
MHV	MV
µA	µA
BAG	Bag
BAR	bar
BTL	Bottle
BOX	BOX
BQK	Bq/kg
RF	mF
M/M	Mo/m3
M/L	Mol/Liter
NA	nA
C3S	cm3/s
R-U	nF
NMM	N/mm2
CCM	cm3
CD	cd
CD3	Cubic dec.
CM	cm
CM2	cm2
CMH	cm/h
CV	Case
CL	Centiliter
CYL	Cylinder
S/M	Siemens/m
TOM	t/m3
VAM	VA
DEG	Degree
DM	dm
DR	Drum
DZ	Dozen
EA	each
EU	Enzy.Units
EML	Enzyme/ml
F	F
°F	°F
FT	Feet
FT2	Square ft
FT3	Cubic ft
G	g
G/L	gai/liter
GAU	Gram Gold
°C	°C
GHG	g/hg
GJ	Gigajoule
GKG	g/kg
GLI	g/l
GAL	US gallon
GPM	Gal/Mi(US)
GM	g/mol
GM2	g/m2
GPH	Gal/hr US
µGQ	µg/m3
GRO	Gross
GAI	g act.ing.
H	Hour
HA	Hectare
HED	Head
HL	hl
HPA	hPa
HSE	House
HZ	Hz
IBC	IBC
IN	Inch
"2	Inch2
"3	Cubic inch
J	J
YR	Year
JKG	J/kg
JKK	J/(kg*K)
JMO	J/mol
JOB	JOB
JRG	Jerrycan
K	K
KA	kA
CAN	Canister
CAR	Carton
KBK	kBq/kg
KG	kilogram
KGF	kg/m2
KGK	kg/kg
KGM	kg/mol
KGS	kg/s
KGV	kg/m3
KAI	kg ac.ing.
KHZ	kHz
CRT	Crate
KIT	Kit
KJ	kJ
KJK	KJ/kg
KJM	KJ/mol
KM	km
KM2	km2
KMH	km/h
KMK	m3/m3
KMN	K/min
KMS	K/s
KOH	kOhm
KPA	kPa
KT	kt
KV	kV
KVA	kVA
KW	KW
KWH	kW.h
KIK	kai/kg
LTR	l
LMI	l/min
LB	Pound
AU	AU
LHK	l/100 km
LMS	l/mol.s
LOD	Load
LOT	Lot
LPH	Liter/hr
MTR	meter
M%	%(m)
M%O	%0(mass)
M/S	m/s
M2	m2
M-2	1/M2
M2S	m2/s
M3	m3
M3D	m3/day
M3S	m3/s
MA	mA
MBA	mbar
MBZ	m.bar/s
MEJ	MJ
MG	mg
MGE	mg/cm2
MGG	mg/g
MGK	mg/kg
MGL	mg/l
MGQ	mg/m3
MGW	VA
MHZ	MHz
MI	Mile
MI2	Mile2
µM	µm
MIN	min.
MIS	µs
MIJ	mJ
ML	ml
MLK	ml/m3
MLI	ml act.in.
MM	mm
MM2	mm2
MMA	mm/a
MMG	mmol/g
MMH	mm/h
MMK	mmol/kg
MMO	mmol
MM3	mm3
MMS	mm/s
MNM	mN/m
MOK	mol/kg
MOL	mol
MON	Months
MPA	MPa
MPB	ppb(m)
MPG	Mi/Gal(US)
MPM	ppm(m)
MPS	mPa.s
MPT	ppt(m)
MPZ	m.Pa/s
M3H	m3/h
MSE	ms
MS2	m/s2
MT	Metric Ton
MTE	mT
M/H	m/h
MV	mV
MVA	MVA
MW	mW
MWH	MWh
N	N
NAM	nm
NM	N/m
NS	ns
OCM	Ohm*cm
OHM	Ohm
OM	Ohm*m
OZ	Ounce
FOZ	Fld.oz US
P	Points
PA	Pa
PAA	Pair
PAI	Pail
PAC	Pack
PAL	Pallet
PAS	Pascal sec
PCH	Pouch
PRC	Group prop
PMI	1/min
PMR	kg/m2*s
PPB	ppb
PPM	ppm
PPT	ppt
PRM	ug/cm2*min
PRS	Persons
PS	ps
PT	Pint US l
QT	Quart US l
REA	Ream
RHO	g/cm3
RIM	RIM
RLL	Roll
ROL	Role
S	s
SET	Set
SRV	Service
PCS	Piece
HR	Hours
DAY	Days
TC3	1/cm3
TES	D
TS	Thousands
TIN	TIN
TM3	1/m3
TNG	Tong
TNK	Tank
TO	t
TON	US Ton
TRY	Tray
001	
TUB	Tube
µGL	µg/l
UNT	Unit
V	V
V%	%(V)
V%O	%O(V)
MSC	µS/cm
MPL	Millimol/l
VAL	Value
VPB	ppb(V)
VPM	ppm(V)
VPT	ppt(V)
W	W
WK	Weeks
WMK	W/(m*K)
WKY	kg/s*m2
YD	Yards
YD2	Yard2
YD3	Cubic yard
bbl	Btu/bbl
bft	Btu/ft3
bgl	Btu/gal
btl	Btu/lb
gj3	GJ/1000m3
gjm	GJ/m3
gjt	GJ/ton
jm3	J/m3
kgb	kg/bbl
kgj	kg/J
kgm	kg/MMBtu
kgs	kg/scf
kgt	kg/ton
kml	kg/kg mole
lbb	lb/Btu
lbg	lb/gal
lbl	lb/lb mol
lbm	lb/MMBtu
lbs	lb/scf
lbt	lb/ton
mbb	MMBtu/bbl
mbt	MMBtu/ton
tbl	t/bbl
tbt	t/Btu
tgl	ton/gal
tjl	t/Joule
tm3	t/1000m3
tt	t/t
ttj	t/TJ`;
  root.WorkHubValidatorReferences = Object.freeze({
    unitOfMeasurement() {
      return {
        id: root.WorkHubValidatorEngine.uid(),
        preset: 'unit-of-measurement',
        name: 'Unit of Measurement',
        headers: ['MEINS', 'DESCRIPTION'],
        rows: units.split('\n').map(line => line.split('\t')),
        codeColumn: 'MEINS',
        nameColumn: 'DESCRIPTION',
        descriptionColumns: [],
        caseSensitive: true,
      };
    },
  });
})(window);
