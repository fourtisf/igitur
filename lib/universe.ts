import type { BallastEntry, Kind, Theme, UniverseEntry } from "./types";

/**
 * THE UNIVERSE — 26 themes, 170 asset entries, 354 keywords.
 *
 * Ported verbatim from the prototype (HANDOFF.md §1, §7). `kw` pulls a premise
 * toward a theme, `neg` pushes it away — that is what stops "delivery drones"
 * resolving to defence stocks.
 *
 * Every theme's `claim` must build a book that resolves to that same theme.
 * That is a regression test, not a convention: three themes once failed it
 * because their claims used words their own keyword lists did not contain.
 */

/** Asset factory. Mirrors the prototype's `A()` so the data reads the same. */
function a(t: string, n: string, k: Kind, c: number, why: string) {
  return { t, n, k, c, why };
}

/** The date the published universe was last reviewed. Shown on /universe. */
export const REVIEWED = "1 September 2026";

/**
 * The version of the published universe.
 *
 * A book is deterministic *for a given universe*, not absolutely. Move one
 * conviction score by six points — an ordinary editorial revision, and /method
 * says these are editorial judgements — and every previously shared book that
 * touches that theme reorders and reweights. The reader who opens a month-old
 * link sees a different book and believes it is the one that was sent.
 *
 * So every book URL carries the version it was built against, and a book built
 * against an older one says so. Bump this on ANY change to THEMES or BALLAST:
 * a new name, a dropped name, a reworded reason, a moved conviction score. Then
 * add the release to CHANGELOG below, which is what /changes publishes.
 */
export const UNIVERSE_VERSION = 1;

export interface UniverseRelease {
  version: number;
  /** The date this version became the published universe. */
  date: string;
  summary: string;
  /** One line per change. Empty for the first release. */
  changes: string[];
}

/** Newest first. Published at /changes. */
export const CHANGELOG: UniverseRelease[] = [
  {
    version: 1,
    date: "1 September 2026",
    summary:
      "The first published universe: 26 themes, 160 names and 3 ballast instruments, each with a written reason and a conviction score.",
    changes: [],
  },
];

/**
 * Ballast sleeve. Index 0 is used for Speculative books, index 2 for
 * Conservative, and one of 0/1 is drawn from the premise seed otherwise.
 */
export const BALLAST: BallastEntry[] = [
  { t: "SGOV", n: "0–3 Month Treasury Bill ETF", k: "Treasury", why: "Cash that still earns while the thesis is early." },
  { t: "IEF", n: "7–10 Year Treasury ETF", k: "Treasury", why: "Duration that tends to rally when growth disappoints." },
  { t: "GLD", n: "Gold Trust", k: "Commodity", why: "A hedge that does not depend on this thesis being right." },
];

export const THEMES: Theme[] = [
  {
    id: "compute",
    name: "Compute buildout",
    risk: "Aggressive",
    horizon: "3–5 years",
    claim:
      "Compute is the binding constraint on artificial intelligence, not model design.",
    forCase:
      "Frontier training runs are gated by physical supply, not ideas. Leading-edge capacity is booked years out, high-bandwidth memory is sold before it is made, and grid interconnection queues run for years. Anything on that critical path collects the toll.",
    againstCase:
      "Every capex supercycle in semiconductors has ended in a glut. Efficiency gains, smaller models and custom silicon all cut the accelerators needed per unit of intelligence, and buyers are a handful of firms who can pause in one quarter.",
    kw: [
      "ai", "artificial intelligence", "compute", "gpu", "chip", "chips",
      "semiconductor", "silicon", "inference", "training", "datacenter", "datacentre",
      "data center", "llm", "agi", "frontier model", "wafer", "accelerator", "foundry",
      "hbm"
    ],
    neg: [],
    assets: [
      a("NVDA", "Nvidia", "Equity", 97,
        "Sits on the critical path of nearly every frontier training run."),
      a("TSM", "Taiwan Semiconductor", "Equity", 93,
        "Leading-edge dies are fabricated here or they are not fabricated."),
      a("ASML", "ASML", "Equity", 88,
        "Sole supplier of EUV lithography; there is no second source."),
      a("AVGO", "Broadcom", "Equity", 84,
        "Custom accelerators for buyers who want off a single vendor's price list."),
      a("MU", "Micron", "Equity", 80,
        "High-bandwidth memory is the second bottleneck after the die."),
      a("VRT", "Vertiv", "Equity", 74,
        "Power and cooling inside the rack, where density fails first."),
      a("ANET", "Arista Networks", "Equity", 69,
        "The switching fabric between accelerators."),
      a("SMH", "Semiconductor ETF", "ETF", 62,
        "Broad exposure for the part that is not a single-name bet."),
      a("SMCI", "Super Micro Computer", "Equity", 48,
        "Integration and assembly — real volume, thinnest moat in the chain."),
    ],
  },
  {
    id: "energy",
    name: "Grid and load growth",
    risk: "Moderate",
    horizon: "5–10 years",
    claim:
      "Electricity demand grows for the first time in twenty years, and the grid cannot be built quickly.",
    forCase:
      "Datacentres, electrified transport and reshored manufacturing pull on the same wires. Generation adds in months; transmission and interconnection take most of a decade. Scarcity accrues to whoever holds capacity or builds the equipment.",
    againstCase:
      "Utilities are rate-regulated, so upside is capped by regulators answering to voters with rising bills. Load forecasts have been wrong before and much of the demand is announced rather than contracted.",
    kw: [
      "energy", "grid", "power", "electricity", "electric", "load growth", "utility",
      "utilities", "transmission", "solar", "renewable", "electrification", "megawatt",
      "transformer", "interconnection"
    ],
    neg: [],
    assets: [
      a("GEV", "GE Vernova", "Equity", 91,
        "Turbines and grid equipment; the order book is the constraint."),
      a("CEG", "Constellation Energy", "Equity", 89,
        "Existing baseload under contracts signed before the shortage."),
      a("VST", "Vistra", "Equity", 84,
        "Merchant generation with direct exposure to power prices."),
      a("ETN", "Eaton", "Equity", 81,
        "Electrical distribution sits between every new load and the wire."),
      a("NEE", "NextEra Energy", "Equity", 77,
        "The largest renewables pipeline, with a regulated utility underneath."),
      a("PWR", "Quanta Services", "Equity", 75,
        "Someone has to physically build the transmission; this is who."),
      a("XLU", "Utilities Select Sector ETF", "ETF", 58,
        "The sector floor, for the part that is simply more electricity."),
      a("FSLR", "First Solar", "Equity", 54,
        "Domestic panel supply, exposed to policy in both directions."),
    ],
  },
  {
    id: "nuclear",
    name: "Nuclear restart",
    risk: "Aggressive",
    horizon: "5–10 years",
    claim:
      "Firm carbon-free baseload becomes acceptable again because nothing else clears the demand.",
    forCase:
      "Datacentre operators need power that runs at night and does not move with weather. Restarts and uprates of existing plants are the cheapest megawatts available, and fuel supply sits in very few hands.",
    againstCase:
      "Nuclear has decades of practice being late and over budget. Small modular designs are mostly unbuilt, and the policy support that opened the door can close after one bad headline.",
    kw: [
      "nuclear", "uranium", "smr", "fission", "reactor", "atomic", "baseload",
      "enrichment", "fuel cycle"
    ],
    neg: [],
    assets: [
      a("CCJ", "Cameco", "Equity", 92,
        "Fuel is upstream of every reactor, running or planned."),
      a("BWXT", "BWX Technologies", "Equity", 89,
        "Naval and government reactor components; revenue that already exists."),
      a("LEU", "Centrus Energy", "Equity", 85,
        "Domestic enrichment, the actual bottleneck for advanced fuel."),
      a("CEG", "Constellation Energy", "Equity", 83,
        "The largest existing fleet; restarts beat new builds on time."),
      a("VST", "Vistra", "Equity", 76,
        "Nuclear capacity inside a merchant power book."),
      a("URA", "Uranium ETF", "ETF", 64,
        "Basket exposure to miners without picking which deposit works."),
      a("SMR", "NuScale Power", "Equity", 52,
        "The purest expression of the thesis and the least proven."),
    ],
  },
  {
    id: "longevity",
    name: "Healthspan",
    risk: "Moderate",
    horizon: "Up to 10 years",
    claim:
      "Medicine shifts from treating disease late to extending the years a person stays healthy.",
    forCase:
      "Metabolic drugs turned out to affect far more than weight. Sequencing costs fell far enough to make genetic medicine economic, and the payer is a demographic wave already here.",
    againstCase:
      "Drug pricing is a political target in every developed market. Patents expire on schedule, trials fail late and expensively, and the largest products already carry near-perfect expectations.",
    kw: [
      "longevity", "aging", "ageing", "healthspan", "biotech", "gene", "genetic",
      "genome", "obesity", "drug", "pharma", "crispr", "cancer", "therapeutic",
      "clinical trial", "sequencing", "medicine", "disease", "healthy", "healthcare",
      "treatment", "patient"
    ],
    neg: [],
    assets: [
      a("LLY", "Eli Lilly", "Equity", 93,
        "The broadest metabolic franchise and deepest follow-on pipeline."),
      a("NVO", "Novo Nordisk", "Equity", 86,
        "The other half of the metabolic duopoly, with more pricing exposure."),
      a("VRTX", "Vertex Pharmaceuticals", "Equity", 84,
        "Genetic medicine that already generates cash, not just readouts."),
      a("ILMN", "Illumina", "Equity", 79,
        "Sequencing is the instrument layer under everything genetic."),
      a("REGN", "Regeneron", "Equity", 75,
        "An antibody platform that has produced beyond one franchise."),
      a("TMO", "Thermo Fisher Scientific", "Equity", 72,
        "Tools and reagents; paid whether or not a trial reads out."),
      a("XBI", "Biotech ETF", "ETF", 61,
        "Spread across small-cap biotech, where single-name risk is brutal."),
      a("CRSP", "CRISPR Therapeutics", "Equity", 49,
        "Approved editing therapy, tiny commercial base, wide outcomes."),
    ],
  },
  {
    id: "robotics",
    name: "Physical labour automation",
    risk: "Aggressive",
    horizon: "Up to 10 years",
    claim:
      "Machines that manipulate the physical world become cheap enough to replace repetitive human labour.",
    forCase:
      "Vision and control models improved faster than the hardware around them. Warehouses are the ideal first environment: structured, indoors, already measured to the second. Labour cost and availability push the same way.",
    againstCase:
      "Demonstrations are not deployments. Reliability in unstructured environments is unsolved, and payback only works at wage levels most of the world does not pay.",
    kw: [
      "robot", "robots", "robotics", "robotic", "humanoid", "automation", "warehouse",
      "factory automation", "actuator", "manipulation", "manipulate", "cobot",
      "machines", "manual labour", "manual labor", "human labour", "human labor",
      "repetitive"
    ],
    neg: [],
    assets: [
      a("ROK", "Rockwell Automation", "Equity", 88,
        "Factory integration is where deployment actually happens."),
      a("SYM", "Symbotic", "Equity", 85,
        "Warehouse automation already installed and running at scale."),
      a("TSLA", "Tesla", "Equity", 80,
        "The clearest public humanoid programme, inside a business that is not one."),
      a("NVDA", "Nvidia", "Equity", 78,
        "Simulation and on-robot inference; paid whichever robot wins."),
      a("TER", "Teradyne", "Equity", 74,
        "Collaborative arms plus test equipment for the rest of the chain."),
      a("ISRG", "Intuitive Surgical", "Equity", 69,
        "Proof that precision robotics can hold a monopoly for two decades."),
      a("BOTZ", "Robotics & AI ETF", "ETF", 60,
        "Broad exposure without a bet on form factor."),
    ],
  },
  {
    id: "lastmile",
    name: "Last-mile logistics",
    risk: "Moderate",
    horizon: "3–5 years",
    claim:
      "The final mile of delivery is automated and re-priced, because it is where most of the cost sits.",
    forCase:
      "The last mile is roughly half the total cost of a parcel and the least automated link in the chain. Autonomous vans, sidewalk robots and delivery drones all attack the same line item, and volume grows whichever one wins.",
    againstCase:
      "Regulation is local, slow and fragmented — approvals happen city by city. Margins in delivery have been thin for a century, and incumbents can absorb losses far longer than a challenger can.",
    kw: [
      "delivery", "last mile", "last-mile", "courier", "parcel", "package", "shipping",
      "freight", "logistics", "fulfilment", "fulfillment", "supply chain", "van", "vans",
      "truck", "distribution", "dispatch"
    ],
    neg: ["military", "missile", "warfare", "combat", "battlefield"],
    assets: [
      a("UPS", "United Parcel Service", "Equity", 88,
        "The densest delivery network; automation lands here first."),
      a("AMZN", "Amazon", "Equity", 86,
        "Runs the largest private logistics network and its own robotics arm."),
      a("SYM", "Symbotic", "Equity", 82,
        "Automates the warehouse that feeds every route."),
      a("GXO", "GXO Logistics", "Equity", 79,
        "Pure-play contract logistics, buying automation as a service."),
      a("FDX", "FedEx", "Equity", 74,
        "Network scale with more freight exposure and slower change."),
      a("ZBRA", "Zebra Technologies", "Equity", 68,
        "Scanning and tracking hardware in every depot."),
      a("IYT", "Transportation ETF", "ETF", 56,
        "Sector exposure without picking a carrier."),
    ],
  },
  {
    id: "space",
    name: "Orbital logistics",
    risk: "Aggressive",
    horizon: "5–10 years",
    claim:
      "Launch becomes cheap and routine enough that orbit turns into infrastructure rather than an event.",
    forCase:
      "Cost per kilogram has fallen by more than an order of magnitude and keeps falling. Once launch is routine the value moves to payloads: connectivity, imaging and defence bought on long government contracts.",
    againstCase:
      "The dominant launch provider is private, so public exposure is second-best by construction. Most listed names are pre-revenue, and a single failure resets a company by years.",
    kw: [
      "space", "orbit", "orbital", "satellite", "rocket", "launch", "lunar", "moon",
      "mars", "payload", "aerospace", "low earth orbit"
    ],
    neg: [],
    assets: [
      a("RKLB", "Rocket Lab", "Equity", 92,
        "The only listed pure-play with an operating launch cadence."),
      a("ASTS", "AST SpaceMobile", "Equity", 86,
        "Direct-to-phone connectivity; enormous market, unproven at scale."),
      a("PL", "Planet Labs", "Equity", 77,
        "Imaging as a subscription rather than a hardware sale."),
      a("LUNR", "Intuitive Machines", "Equity", 70,
        "Lunar delivery contracts, dependent on one customer."),
      a("LMT", "Lockheed Martin", "Equity", 64,
        "Space revenue attached to a business that survives a slow decade."),
      a("IRDM", "Iridium Communications", "Equity", 61,
        "An operating constellation with real cash flow today."),
      a("ARKX", "Space Exploration ETF", "ETF", 55,
        "Diversification where single-name failure is common."),
    ],
  },
  {
    id: "quantum",
    name: "Error-corrected quantum",
    risk: "Speculative",
    horizon: "10+ years",
    claim:
      "The real milestone is logical, error-corrected qubits, and the first to reach them takes a market with no second prize.",
    forCase:
      "Error correction has moved from theory to measured improvement on real hardware. Government and hyperscaler contracts arrive before commercial revenue, which funds the gap, and the end state is winner-takes-most.",
    againstCase:
      "Useful quantum advantage has been ten years away for thirty years. Every listed pure-play burns cash and funds itself by issuing stock into rallies. Position sizing matters more than name selection.",
    kw: [
      "quantum", "qubit", "qubits", "superposition", "entanglement", "error correction",
      "post-quantum", "annealing", "coherence"
    ],
    neg: [],
    assets: [
      a("IONQ", "IonQ", "Equity", 90,
        "Trapped ion, deepest balance sheet, clearest contract visibility."),
      a("RGTI", "Rigetti Computing", "Equity", 84,
        "Superconducting hardware with a large-vendor partnership behind it."),
      a("QBTS", "D-Wave Quantum", "Equity", 79,
        "Annealing is commercially earlier, aimed at optimisation today."),
      a("IBM", "IBM", "Equity", 63,
        "A serious roadmap attached to a business that pays you to wait."),
      a("HON", "Honeywell", "Equity", 60,
        "Holds the largest stake in a private trapped-ion competitor."),
      a("QUBT", "Quantum Computing Inc.", "Equity", 58,
        "The most experimental of the four and most dilution-prone."),
      a("QTUM", "Quantum Computing ETF", "ETF", 57,
        "Basket exposure, because which architecture wins is unknown."),
    ],
  },
  {
    id: "defense",
    name: "Rearmament",
    risk: "Moderate",
    horizon: "5–10 years",
    claim:
      "Defence spending rises structurally, and the money moves toward attritable, software-defined systems.",
    forCase:
      "Multi-year procurement budgets are legislated across several blocs. Recent conflicts showed cheap expendable systems and the software coordinating them matter more than fewer exquisite platforms.",
    againstCase:
      "Procurement is slow, political and lumpy. Peace is a real risk, and newer names trade on contract announcements rather than delivered revenue.",
    kw: [
      "defense", "defence", "military", "warfare", "munitions", "missile", "deterrence",
      "army", "navy", "rearmament", "combat", "battlefield", "nato"
    ],
    neg: ["delivery", "parcel", "courier", "grocery", "last mile"],
    assets: [
      a("PLTR", "Palantir", "Equity", 87,
        "The software layer for targeting and logistics, priced accordingly."),
      a("NOC", "Northrop Grumman", "Equity", 84,
        "Strategic programmes with visibility measured in decades."),
      a("KTOS", "Kratos Defense", "Equity", 82,
        "Attritable systems — the doctrine shift, in one company."),
      a("LMT", "Lockheed Martin", "Equity", 79,
        "The largest incumbent; slowest to change, hardest to displace."),
      a("AVAV", "AeroVironment", "Equity", 78,
        "Small unmanned systems already in field use."),
      a("RTX", "RTX", "Equity", 73,
        "Munitions and missile defence, where restocking is happening."),
      a("ITA", "Aerospace & Defense ETF", "ETF", 58,
        "The sector floor, without predicting which programme survives."),
    ],
  },
  {
    id: "water",
    name: "Water scarcity",
    risk: "Conservative",
    horizon: "10+ years",
    claim:
      "Fresh water becomes the constraint that adaptation spending is actually organised around.",
    forCase:
      "Aquifer depletion and ageing pipes are measurable, slow and already funded. Water utilities are among the few regulated assets where the rate base genuinely has to grow, and demand ignores price.",
    againstCase:
      "This is the slowest thesis on the list. Regulated returns cap upside, municipal budgets are constrained, and nothing here re-rates quickly.",
    kw: ["water", "drought", "aquifer", "desalination", "irrigation", "wastewater", "scarcity"],
    neg: [],
    assets: [
      a("XYL", "Xylem", "Equity", 90,
        "Pumps, metering and treatment; paid on every upgrade cycle."),
      a("AWK", "American Water Works", "Equity", 86,
        "The largest regulated water utility, consolidating small systems."),
      a("VLTO", "Veralto", "Equity", 78,
        "Water analytics and quality instrumentation."),
      a("WTRG", "Essential Utilities", "Equity", 74,
        "Regulated water and gas; slower, cheaper, less crowded."),
      a("ECL", "Ecolab", "Equity", 71,
        "Industrial water efficiency, sold as an operating cost saving."),
      a("PHO", "Water Resources ETF", "ETF", 59,
        "Basket exposure to a theme with no obvious single winner."),
    ],
  },
  {
    id: "onchain",
    name: "Tokenised markets",
    risk: "Aggressive",
    horizon: "3–5 years",
    claim:
      "Traditional assets move onto public ledgers, and the rails that carry them collect the fee.",
    forCase:
      "Stablecoin settlement is at meaningful scale and regulated in several jurisdictions. Tokenised treasuries went from nothing to billions in under two years, and the venues holding the on-ramps monetise the transition whichever chain wins.",
    againstCase:
      "Regulation can reverse faster here than anywhere else on this list. Fee compression is the historical norm for market infrastructure, and much current volume is speculative rather than structural.",
    kw: [
      "onchain", "on-chain", "crypto", "blockchain", "tokenization", "tokenisation",
      "tokenized", "tokenised", "defi", "stablecoin", "bitcoin", "ethereum", "rwa",
      "real world asset", "settlement", "ledger"
    ],
    neg: [],
    assets: [
      a("COIN", "Coinbase", "Equity", 90,
        "The regulated on-ramp with the widest institutional footprint."),
      a("CRCL", "Circle", "Equity", 87,
        "Stablecoin issuance is the clearest revenue line in the sector."),
      a("HOOD", "Robinhood Markets", "Equity", 83,
        "Retail distribution plus a chain of its own for tokenised equities."),
      a("ETH", "Ethereum", "Crypto", 80,
        "Settlement layer where most tokenised assets currently live."),
      a("BTC", "Bitcoin", "Crypto", 70,
        "The reserve asset of the sector; correlated to it, not a bet on rails."),
      a("BLK", "BlackRock", "Equity", 68,
        "The largest issuer moving funds on-chain."),
      a("CME", "CME Group", "Equity", 60,
        "The incumbent venue; wins slowly if the transition is orderly."),
    ],
  },
  {
    id: "media",
    name: "Media consolidation",
    risk: "Moderate",
    horizon: "3–5 years",
    claim:
      "Streaming consolidates into a handful of profitable players and the rest are absorbed or wound down.",
    forCase:
      "Content spending peaked while subscriber growth slowed, which forces consolidation. Survivors gain pricing power, bundle leverage and an ad tier that monetises the users who will not pay more.",
    againstCase:
      "Content is a hit business dressed as a subscription business. Regulators can block the very mergers the thesis needs, and attention keeps leaking to short-form video none of these companies own.",
    kw: [
      "streaming", "media", "film", "television", "studio", "subscriber", "bundle",
      "hollywood", "entertainment", "music"
    ],
    neg: [],
    assets: [
      a("NFLX", "Netflix", "Equity", 90,
        "The only scaled streamer profitable through the whole cycle."),
      a("DIS", "Disney", "Equity", 82,
        "Library depth and parks cash flow to fund the transition."),
      a("SPOT", "Spotify", "Equity", 78,
        "The same consolidation logic, playing out earlier in audio."),
      a("CMCSA", "Comcast", "Equity", 68,
        "Distribution plus content, priced as if neither works."),
      a("WBD", "Warner Bros. Discovery", "Equity", 64,
        "The most likely to be bought rather than to buy."),
      a("LYV", "Live Nation", "Equity", 61,
        "Live experience is the part of entertainment that cannot be streamed."),
    ],
  },
  {
    id: "banks",
    name: "Banking and credit",
    risk: "Moderate",
    horizon: "3–5 years",
    claim:
      "Deposit franchises and private credit take share as regulated lending retreats from the middle market.",
    forCase:
      "Post-crisis rules pushed lending out of banks and into funds that charge more for it. The largest banks keep the cheap deposits, the alternative managers keep the spread, and both sides of that trade are listed.",
    againstCase:
      "Credit losses are invisible until they are not. Private credit has never been tested through a full default cycle, and the marks are set by the managers themselves.",
    kw: [
      "bank", "banks", "banking", "credit", "lending", "loan", "loans", "deposit",
      "private credit", "mortgage lending", "interest rate", "yield curve", "financials"
    ],
    neg: [],
    assets: [
      a("JPM", "JPMorgan Chase", "Equity", 88,
        "The deposit franchise everything else is measured against."),
      a("BX", "Blackstone", "Equity", 85,
        "The largest alternative manager; fee streams over cyclical balance sheet."),
      a("ARES", "Ares Management", "Equity", 82,
        "The purest listed expression of private credit growth."),
      a("KKR", "KKR", "Equity", 76,
        "Alternative assets with more balance-sheet exposure than peers."),
      a("GS", "Goldman Sachs", "Equity", 73,
        "Advisory and markets, geared to the transaction cycle."),
      a("XLF", "Financial Select Sector ETF", "ETF", 57,
        "Sector exposure without picking which balance sheet is clean."),
    ],
  },
  {
    id: "housing",
    name: "Housing shortage",
    risk: "Moderate",
    horizon: "5–10 years",
    claim:
      "A structural housing shortage persists, and the money accrues to builders, materials and rental owners.",
    forCase:
      "Two decades of underbuilding met a demographic wave of first-time buyers. Owners locked into cheap mortgages will not sell, which starves resale supply and pushes demand into new construction and rentals.",
    againstCase:
      "Housing is the most rate-sensitive sector there is. Affordability is already stretched, and policy can add supply or cap rents in ways that break the pricing assumption entirely.",
    kw: [
      "housing", "home", "homes", "property", "real estate", "rent", "rental",
      "construction", "builder", "shelter", "apartment", "homebuilder"
    ],
    neg: [],
    assets: [
      a("DHI", "D.R. Horton", "Equity", 88,
        "The largest builder by volume, aimed at entry-level demand."),
      a("LEN", "Lennar", "Equity", 85,
        "Scale plus a land-light model that reduces cycle risk."),
      a("BLDR", "Builders FirstSource", "Equity", 80,
        "Materials and components; paid on starts, not on prices."),
      a("INVH", "Invitation Homes", "Equity", 76,
        "Owns the rental side of the same shortage."),
      a("HD", "Home Depot", "Equity", 70,
        "Repair and remodel spend when people cannot move."),
      a("ITB", "Home Construction ETF", "ETF", 57,
        "Sector exposure across builders and suppliers."),
    ],
  },
  {
    id: "minerals",
    name: "Critical minerals",
    risk: "Aggressive",
    horizon: "5–10 years",
    claim:
      "Supply of the metals that electrification depends on cannot expand as fast as demand for them.",
    forCase:
      "Copper, lithium and rare earths all take a decade from discovery to production, and permitting has slowed everywhere. Electrification and defence demand arrive on a much shorter clock, and processing is concentrated in one country.",
    againstCase:
      "Commodity theses die on substitution and recycling. Prices high enough to prove the thesis are exactly the prices that fund new supply and kill it.",
    kw: [
      "copper", "lithium", "rare earth", "mineral", "minerals", "mining", "miner",
      "miners", "metals", "cobalt", "nickel", "commodity", "smelting", "refining", "ore",
      "copper supply", "metal supply"
    ],
    neg: [],
    assets: [
      a("FCX", "Freeport-McMoRan", "Equity", 90,
        "The largest listed copper pure-play with expandable assets."),
      a("MP", "MP Materials", "Equity", 86,
        "The only meaningful rare earth supply chain outside China."),
      a("SCCO", "Southern Copper", "Equity", 80,
        "Long-life low-cost copper reserves."),
      a("ALB", "Albemarle", "Equity", 74,
        "Lithium at scale, fully exposed to the price cycle."),
      a("BHP", "BHP Group", "Equity", 70,
        "Diversified miner; slower upside, far more durable."),
      a("COPX", "Copper Miners ETF", "ETF", 58,
        "Basket exposure without single-mine risk."),
    ],
  },
  {
    id: "cyber",
    name: "Cyber defence",
    risk: "Moderate",
    horizon: "3–5 years",
    claim:
      "Security spending grows regardless of the budget cycle because the attack surface keeps expanding.",
    forCase:
      "Cloud migration, remote work and now autonomous agents each added attack surface faster than defences. Security is one of the last line items cut, and the market consolidates toward platforms rather than point tools.",
    againstCase:
      "The sector is crowded and already discounts a lot of growth. Every incumbent platform vendor bundles security for free, which compresses pricing for pure-plays over time.",
    kw: [
      "cyber", "cybersecurity", "hacking", "ransomware", "breach", "zero trust",
      "encryption", "phishing", "malware", "infosec", "attack surface",
      "security spending", "security software", "intrusion"
    ],
    neg: [],
    assets: [
      a("PANW", "Palo Alto Networks", "Equity", 89,
        "The broadest platform consolidation story in the sector."),
      a("CRWD", "CrowdStrike", "Equity", 87,
        "Endpoint agent with the widest telemetry footprint."),
      a("ZS", "Zscaler", "Equity", 80,
        "Network access rebuilt for a world with no perimeter."),
      a("FTNT", "Fortinet", "Equity", 74,
        "Hardware-anchored, cheaper, slower growing."),
      a("OKTA", "Okta", "Equity", 70,
        "Identity is the control plane once the perimeter is gone."),
      a("BUG", "Cybersecurity ETF", "ETF", 57,
        "Basket exposure in a sector prone to single-name blowups."),
    ],
  },
  {
    id: "payments",
    name: "Payments rewiring",
    risk: "Moderate",
    horizon: "3–5 years",
    claim:
      "Payment rails are rebuilt around real-time settlement and the incumbent toll is renegotiated.",
    forCase:
      "Card networks earn a toll set before the internet existed. Instant payment schemes, account-to-account rails and stablecoins each attack that toll, while total transaction volume compounds regardless of who routes it.",
    againstCase:
      "The card networks have survived every disruption for forty years and own the fraud and dispute infrastructure nobody wants to rebuild. Interchange regulation cuts both ways.",
    kw: [
      "payment", "payments", "fintech", "interchange", "checkout", "merchant",
      "transaction", "remittance", "instant payment", "card network"
    ],
    neg: [],
    assets: [
      a("V", "Visa", "Equity", 86,
        "The toll booth; wins on volume even when rates are squeezed."),
      a("MA", "Mastercard", "Equity", 84,
        "The same toll with more exposure to cross-border growth."),
      a("ADYEY", "Adyen", "Equity", 80,
        "Single-platform acquiring, taking share from legacy processors."),
      a("CRCL", "Circle", "Equity", 76,
        "Stablecoin settlement as the credible new rail."),
      a("FI", "Fiserv", "Equity", 70,
        "Merchant and bank infrastructure, cheap and unloved."),
      a("PYPL", "PayPal", "Equity", 63,
        "Distribution without a durable rail of its own."),
    ],
  },
  {
    id: "emerging",
    name: "Manufacturing relocation",
    risk: "Aggressive",
    horizon: "5–10 years",
    claim:
      "Manufacturing moves out of one dominant country, and India and South-East Asia absorb the largest share.",
    forCase:
      "Tariffs, export controls and one pandemic taught every board the cost of single-country sourcing. India has the labour force and the policy support; Vietnam, Mexico and Indonesia take the assembly steps that move first.",
    againstCase:
      "Relocation is measured in decades, not quarters, and the supplier ecosystem that makes China cheap took thirty years to build. Currency and governance risk are real, and access is mostly through funds.",
    kw: [
      "india", "indian", "indonesia", "indonesian", "vietnam", "vietnamese", "mexico",
      "mexican", "emerging market", "emerging markets", "reshoring", "friendshoring",
      "manufacturing hub", "asean", "southeast asia", "south-east asia", "relocation",
      "tariff", "tariffs"
    ],
    neg: [],
    assets: [
      a("INDA", "India Large-Cap ETF", "ETF", 89,
        "The broadest listed access to Indian equities."),
      a("SMIN", "India Small-Cap ETF", "ETF", 83,
        "Domestic manufacturing exposure the large caps do not carry."),
      a("EWW", "Mexico ETF", "ETF", 76,
        "Nearshoring for North American demand."),
      a("HDB", "HDFC Bank", "Equity", 74,
        "Credit growth is the cleanest proxy for domestic expansion."),
      a("EWY", "South Korea ETF", "ETF", 72,
        "The supplier tier that relocates alongside assembly."),
      a("EEM", "Emerging Markets ETF", "ETF", 58,
        "The floor, for the part of the thesis that is simply not one country."),
    ],
  },
  {
    id: "agri",
    name: "Food and agriculture",
    risk: "Conservative",
    horizon: "5–10 years",
    claim:
      "Yield growth slows while demand rises, so the value moves to inputs, seeds and processing.",
    forCase:
      "Arable land per person keeps falling and weather volatility raises the cost of a bad year. Seed genetics, fertiliser and irrigation are the levers left, and all three are concentrated among a handful of suppliers.",
    againstCase:
      "Agriculture is brutally cyclical and politically managed everywhere. One good harvest resets prices, and subsidy regimes can rewrite the economics overnight.",
    kw: [
      "food", "agriculture", "farming", "farm", "crop", "crops", "harvest", "fertiliser",
      "fertilizer", "seed", "coffee", "grain", "livestock", "soil", "arable"
    ],
    neg: [],
    assets: [
      a("DE", "Deere", "Equity", 88,
        "Equipment plus precision agriculture software on top of it."),
      a("CTVA", "Corteva", "Equity", 86,
        "Seed genetics and crop protection, the actual yield lever."),
      a("NTR", "Nutrien", "Equity", 78,
        "Fertiliser at scale, fully exposed to the price cycle."),
      a("ADM", "Archer-Daniels-Midland", "Equity", 72,
        "Processing and trading; paid on volume, not on price."),
      a("MOS", "Mosaic", "Equity", 66,
        "Phosphate and potash, the most cyclical link in the chain."),
      a("DBA", "Agriculture Fund", "ETF", 56,
        "Direct soft-commodity exposure without an operating company."),
    ],
  },
  {
    id: "insurance",
    name: "Climate risk repricing",
    risk: "Conservative",
    horizon: "5–10 years",
    claim:
      "Insurers reprice physical climate risk faster than anyone else, and that repricing is where the earnings are.",
    forCase:
      "Catastrophe losses forced rates up across property lines and pushed capital out of the market, which is exactly when underwriting returns are best. Reinsurers hold the pricing power in a hard market.",
    againstCase:
      "One extraordinary season erases several good ones. Regulators cap rates in the states that need them most, and modelling error is the whole business.",
    kw: [
      "insurance", "insurer", "reinsurance", "catastrophe", "underwriting", "premium",
      "climate risk", "flood", "hurricane", "wildfire", "adaptation", "resilience",
      "climate"
    ],
    neg: [],
    assets: [
      a("RNR", "RenaissanceRe", "Equity", 88,
        "Pure reinsurance exposure to a hard pricing cycle."),
      a("EG", "Everest Group", "Equity", 84,
        "Reinsurance and primary, with reserve depth."),
      a("CB", "Chubb", "Equity", 79,
        "Disciplined commercial underwriting through the cycle."),
      a("TRV", "Travelers", "Equity", 72,
        "Personal and commercial property, more rate-regulated."),
      a("AON", "Aon", "Equity", 68,
        "Brokerage earns the fee whichever way pricing moves."),
      a("KIE", "Insurance ETF", "ETF", 55,
        "Sector exposure across underwriters and brokers."),
    ],
  },
  {
    id: "consumer",
    name: "Attention and brands",
    risk: "Moderate",
    horizon: "3–5 years",
    claim:
      "Attention keeps concentrating in a few platforms, and brands pay whatever those platforms charge.",
    forCase:
      "Advertising follows time spent, and time spent keeps consolidating into short-form video and search. The platforms with first-party data and ad tech of their own take share from everyone renting audience.",
    againstCase:
      "Advertising is the first budget cut in a downturn. Privacy rules keep tightening, and these are the most exposed companies in the market to antitrust action.",
    kw: [
      "advertising", "advertisement", "advertising spend", "brand", "brands", "consumer",
      "retail", "attention", "social media", "influencer", "marketing", "e-commerce",
      "ecommerce"
    ],
    neg: [],
    assets: [
      a("META", "Meta Platforms", "Equity", 89,
        "The largest attention pool with the deepest ad stack."),
      a("GOOGL", "Alphabet", "Equity", 86,
        "Search plus video; intent and attention in one company."),
      a("AMZN", "Amazon", "Equity", 80,
        "Retail media is the fastest-growing ad business in the market."),
      a("TTD", "The Trade Desk", "Equity", 74,
        "The independent buy side, squeezed between the giants."),
      a("SHOP", "Shopify", "Equity", 70,
        "The merchant layer that all of that traffic lands on."),
      a("NKE", "Nike", "Equity", 60,
        "A brand strong enough to pay the toll and still hold margin."),
    ],
  },
  {
    id: "software",
    name: "Software after agents",
    risk: "Aggressive",
    horizon: "3–5 years",
    claim:
      "Software pricing shifts from seats to outcomes as agents do work that used to require a licence per person.",
    forCase:
      "If an agent does the work, seat-based pricing collapses and the vendors that own the system of record capture the value instead. Those vendors have the data, the workflow and the switching costs.",
    againstCase:
      "This is the most contested thesis on the list. If agents commoditise the application layer, incumbents lose pricing power rather than gain it, and the winner may not be listed yet.",
    kw: [
      "software", "saas", "enterprise software", "agent", "agents", "seat", "licence",
      "license", "workflow", "crm", "erp", "productivity"
    ],
    neg: [],
    assets: [
      a("MSFT", "Microsoft", "Equity", 90,
        "Owns the workflow, the model access and the distribution."),
      a("NOW", "ServiceNow", "Equity", 86,
        "The workflow system of record most exposed to agent pricing."),
      a("CRM", "Salesforce", "Equity", 78,
        "The largest seat-based base, and the most to lose or gain."),
      a("SNOW", "Snowflake", "Equity", 76,
        "Agents need governed data; this is where it sits."),
      a("DDOG", "Datadog", "Equity", 72,
        "Consumption-priced already, so the model shift helps."),
      a("IGV", "Software ETF", "ETF", 56,
        "Sector exposure while the pricing question resolves."),
    ],
  },
  {
    id: "travel",
    name: "Experience spending",
    risk: "Moderate",
    horizon: "3–5 years",
    claim:
      "Discretionary spending keeps shifting from goods to experiences, and the supply of experiences is fixed.",
    forCase:
      "Travel, live events and dining recovered past pre-pandemic levels and kept going, while hotel rooms, aircraft and venues expand slowly. Fixed supply meeting rising demand is a pricing story.",
    againstCase:
      "Experience spending is the most cyclical discretionary category there is. It is funded by savings and confidence, both of which disappear quickly in a downturn.",
    kw: [
      "travel", "tourism", "hotel", "airline", "flight", "cruise", "booking",
      "restaurant", "dining", "concert", "leisure", "experience", "hospitality",
      "vacation"
    ],
    neg: [],
    assets: [
      a("BKNG", "Booking Holdings", "Equity", 88,
        "The demand aggregator; earns the fee whichever hotel wins."),
      a("MAR", "Marriott International", "Equity", 82,
        "Asset-light franchising with global rate exposure."),
      a("RCL", "Royal Caribbean", "Equity", 78,
        "Fixed berth supply and the highest operating leverage in travel."),
      a("LYV", "Live Nation", "Equity", 76,
        "Owns venues, ticketing and promotion of the same event."),
      a("ABNB", "Airbnb", "Equity", 72,
        "Supply that expands without capital, which cuts both ways."),
      a("DAL", "Delta Air Lines", "Equity", 64,
        "Premium cabin mix in the most capital-intensive part of travel."),
    ],
  },
  {
    id: "demographics",
    name: "Ageing societies",
    risk: "Conservative",
    horizon: "10+ years",
    claim:
      "Developed populations age faster than their systems adapt, and the spending follows the demographics.",
    forCase:
      "The retirement wave is the most predictable trend in finance — the people already exist. Healthcare delivery, devices, retirement products and senior housing all have demand curves that are simply known.",
    againstCase:
      "Predictable does not mean profitable. Government is the dominant payer in most of these markets and sets prices to control cost, which caps the return on being right.",
    kw: [
      "demographic", "demographics", "retirement", "pension", "elderly", "senior",
      "boomer", "annuity", "medicare", "population decline", "birth rate",
      "ageing population", "aging population"
    ],
    neg: [],
    assets: [
      a("UNH", "UnitedHealth Group", "Equity", 86,
        "The largest managed-care book aimed at the retiring cohort."),
      a("ABT", "Abbott Laboratories", "Equity", 82,
        "Devices and diagnostics used more with every decade of age."),
      a("SYK", "Stryker", "Equity", 80,
        "Orthopaedics; the demand curve is literally demographic."),
      a("WELL", "Welltower", "Equity", 78,
        "Senior housing, where the supply pipeline is thin."),
      a("MET", "MetLife", "Equity", 68,
        "Annuities and retirement products at scale."),
      a("XLV", "Health Care Select Sector ETF", "ETF", 56,
        "Sector exposure across payers, devices and pharma."),
    ],
  },
  {
    id: "storage",
    name: "Storage and flexibility",
    risk: "Aggressive",
    horizon: "5–10 years",
    claim:
      "Intermittent generation makes storage and demand flexibility more valuable than more generation.",
    forCase:
      "Once enough solar and wind sits on a grid, the scarce product stops being energy and becomes the ability to move it in time. Battery costs keep falling and grid-service revenue stacks are only starting to be priced.",
    againstCase:
      "Battery manufacturing is a commodity business with brutal competition. Much of the current revenue depends on subsidy structures that can be legislated away.",
    kw: [
      "battery", "batteries", "storage", "grid storage", "energy storage", "flexibility",
      "demand response", "intermittency", "hydrogen"
    ],
    neg: [],
    assets: [
      a("FLNC", "Fluence Energy", "Equity", 88,
        "Pure-play grid storage integration."),
      a("TSLA", "Tesla", "Equity", 84,
        "Energy storage deployments now grow faster than the car business."),
      a("ENPH", "Enphase Energy", "Equity", 74,
        "Distributed storage and inverters at the household level."),
      a("ETN", "Eaton", "Equity", 72,
        "The switchgear that makes flexibility possible on the grid."),
      a("EOSE", "Eos Energy", "Equity", 60,
        "Non-lithium chemistry; higher risk, different supply chain."),
      a("LIT", "Battery Tech ETF", "ETF", 56,
        "Basket exposure across chemistry and geography."),
    ],
  },
  {
    id: "education",
    name: "Skills and training",
    risk: "Moderate",
    horizon: "5–10 years",
    claim:
      "Formal credentials matter less than demonstrable skills, and the spending moves to whoever can certify them.",
    forCase:
      "Degree cost outran degree value for a decade while employers moved to skills-based hiring. Continuous retraining becomes a recurring expense rather than a one-off, which is a far better business than a four-year sale.",
    againstCase:
      "Education is slow to change and heavily regulated, and employers still screen on brand-name degrees in practice. Online learning has repeatedly failed to hold completion rates or pricing.",
    kw: [
      "education", "learning", "training", "skills", "credential", "university",
      "degree", "reskilling", "upskilling", "curriculum", "tutoring", "certification"
    ],
    neg: [],
    assets: [
      a("COUR", "Coursera", "Equity", 84,
        "University-branded credentials with corporate distribution."),
      a("DUOL", "Duolingo", "Equity", 86,
        "Consumer habit loop that no institution has replicated."),
      a("LRN", "Stride", "Equity", 76,
        "Public funding attached to online K-12 enrolment."),
      a("ATGE", "Adtalem Global Education", "Equity", 70,
        "Healthcare workforce training where the shortage is measurable."),
      a("PSO", "Pearson", "Equity", 68,
        "Assessment and certification, the part that is hardest to displace."),
      a("CHGG", "Chegg", "Equity", 42,
        "The clearest example of a model that language models undercut."),
    ],
  },
];

/**
 * The published universe: every distinct name a book can hold, plus the
 * benchmark. A book may never contain a ticker that is not in here.
 */
export const UNIVERSE: UniverseEntry[] = (() => {
  const seen = new Set<string>();
  const out: UniverseEntry[] = [];
  for (const th of THEMES) {
    for (const s of th.assets) {
      if (seen.has(s.t)) continue;
      seen.add(s.t);
      out.push({ t: s.t, n: s.n, k: s.k, theme: th.name });
    }
  }
  for (const b of BALLAST) {
    if (seen.has(b.t)) continue;
    seen.add(b.t);
    out.push({ t: b.t, n: b.n, k: b.k, theme: "Ballast" });
  }
  out.push({ t: "SPY", n: "S&P 500 ETF", k: "ETF", theme: "Benchmark" });
  return out;
})();

/** Names excluding the three ballast sleeves and the benchmark. */
export const NAMES = UNIVERSE.length - 4;

export const THEME_BY_ID = new Map(THEMES.map((t) => [t.id, t]));
