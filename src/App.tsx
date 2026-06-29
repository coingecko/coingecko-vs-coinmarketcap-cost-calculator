import { useState } from 'react';
import { Settings2, Info, AlertTriangle, ArrowUpRight, CheckCircle2, XCircle } from 'lucide-react';

// Pricing Data
type Plan = {
  name: string;
  monthly: number;
  yearly: number;
  credits: number;
  commercial: boolean;
  overage: number | null;
  convPerCall?: number;
  maxHistDays: number;
  maxHourlyDays: number;
};

const GECKO_PLANS: Plan[] = [
  { name: 'Demo', monthly: 0, yearly: 0, credits: 10000, commercial: false, overage: null, maxHistDays: 365, maxHourlyDays: 365 },
  { name: 'Basic', monthly: 35, yearly: 29, credits: 100000, commercial: true, overage: 0.0005, maxHistDays: 730, maxHourlyDays: 730 },
  { name: 'Analyst', monthly: 129, yearly: 103, credits: 500000, commercial: true, overage: 0.0005, maxHistDays: Infinity, maxHourlyDays: Infinity },
  { name: 'Lite', monthly: 499, yearly: 399, credits: 2000000, commercial: true, overage: 0.0005, maxHistDays: Infinity, maxHourlyDays: Infinity },
  { name: 'Pro', monthly: 999, yearly: 799, credits: 5000000, commercial: true, overage: 0.0005, maxHistDays: Infinity, maxHourlyDays: Infinity },
];

const CMC_PLANS: Plan[] = [
  { name: 'Basic', monthly: 0, yearly: 0, credits: 15000, commercial: false, convPerCall: 1, overage: null, maxHistDays: 0, maxHourlyDays: 0 },
  { name: 'Builder', monthly: 35, yearly: 29, credits: 150000, commercial: true, convPerCall: 8, overage: null, maxHistDays: 1095, maxHourlyDays: 30 },
  { name: 'Startup', monthly: 95, yearly: 79, credits: 450000, commercial: true, convPerCall: 40, overage: null, maxHistDays: Infinity, maxHourlyDays: 30 },
  { name: 'Growth', monthly: 375, yearly: 299, credits: 2000000, commercial: true, convPerCall: 40, overage: null, maxHistDays: Infinity, maxHourlyDays: 90 },
  { name: 'Professional', monthly: 875, yearly: 699, credits: 5000000, commercial: true, convPerCall: 80, overage: null, maxHistDays: Infinity, maxHourlyDays: 365 },
];

function fmt(n: number) {
  return Math.round(n).toLocaleString('en-US');
}

function fmtUSD(n: number) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

function getGeckoLiveCredits(tokens: number, callsPerDay: number) {
  const physicalCalls = Math.max(1, Math.ceil(tokens / 500));
  return {
    creditsPerCall: physicalCalls,
    physicalCalls,
    monthly: physicalCalls * callsPerDay * 30,
  };
}

function getCmcLiveCredits(tokens: number, currencies: number, callsPerDay: number) {
  const dataPoints = tokens * currencies;
  const creditsPerCall = Math.max(1, Math.ceil(dataPoints / 100));
  return {
    creditsPerCall,
    dataPoints,
    monthly: creditsPerCall * callsPerDay * 30,
  };
}

function pickPlan(plans: Plan[], creditsNeeded: number, requiresCommercial: boolean, requestedHistDays: number, isFetchingHistory: boolean, reqHourlyData: boolean) {
  const eligiblePlans = plans.filter((p) => {
    if (requiresCommercial && !p.commercial) return false;
    if (isFetchingHistory) {
      if (requestedHistDays > p.maxHistDays) return false;
      if (reqHourlyData && requestedHistDays > p.maxHourlyDays) return false;
    }
    return true;
  });

  for (const plan of eligiblePlans) {
    if (plan.credits >= creditsNeeded) return plan;
  }
  return null;
}

function calculateCost(plan: Plan | null, creditsNeeded: number, billing: 'monthly' | 'yearly') {
  if (!plan) return null;
  const base = billing === 'yearly' ? plan.yearly : plan.monthly;
  let overageCost = 0;
  let overageCredits = 0;
  if (creditsNeeded > plan.credits) {
    overageCredits = creditsNeeded - plan.credits;
    if (plan.overage !== null) {
      overageCost = overageCredits * plan.overage;
    } else if (plan.monthly > 0) {
      overageCost = overageCredits * (plan.monthly / plan.credits);
    }
  }
  return { base, overage: overageCost, overageCredits, total: base + overageCost };
}

export default function App() {
  const [workload, setWorkload] = useState<'current' | 'historical' | 'both'>('current');
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [commercial, setCommercial] = useState(false);
  
  const [tokens, setTokens] = useState(250);
  const [currencies, setCurrencies] = useState(1);
  const [callsPerDay, setCallsPerDay] = useState(1440);
  
  const [histTokens, setHistTokens] = useState(50);
  const [histDays, setHistDays] = useState(365);
  const [histCallsPerDay, setHistCallsPerDay] = useState(1);
  const [hourlyData, setHourlyData] = useState(true);

  const showLive = workload === 'current' || workload === 'both';
  const showHist = (workload === 'historical' || workload === 'both');

  const geckoLive = showLive ? getGeckoLiveCredits(tokens, callsPerDay) : { creditsPerCall: 0, physicalCalls: 0, monthly: 0 };
  const cmcLive = showLive ? getCmcLiveCredits(tokens, currencies, callsPerDay) : { creditsPerCall: 0, dataPoints: 0, monthly: 0 };

  const geckoHistCallsPerToken = hourlyData ? Math.ceil(histDays / 100) : 1;
  const geckoHist = showHist ? geckoHistCallsPerToken * histTokens * histCallsPerDay * 30 : 0;
  const cmcHistDataPointsPerToken = hourlyData ? histDays * 24 : histDays;
  const cmcPerHistToken = Math.max(1, Math.ceil(cmcHistDataPointsPerToken / 100));
  const cmcHist = showHist ? cmcPerHistToken * histTokens * histCallsPerDay * 30 : 0;

  const geckoTotal = geckoLive.monthly + geckoHist;
  const cmcTotal = cmcLive.monthly + cmcHist;

  const geckoPlan = pickPlan(GECKO_PLANS, geckoTotal, commercial, histDays, showHist && histTokens > 0, hourlyData);
  const cmcPlan = pickPlan(CMC_PLANS, cmcTotal, commercial, histDays, showHist && histTokens > 0, hourlyData);

  const geckoCost = calculateCost(geckoPlan, geckoTotal, billing);
  const cmcCost = calculateCost(cmcPlan, cmcTotal, billing);

  let winner: 'gecko' | 'cmc' | 'tie' = 'tie';
  let winnerName = 'Tie';
  let absDollarSavings = 0;
  let tieBreakerReason = '';

  if (!cmcCost && !geckoCost) {
    if (geckoTotal < cmcTotal) {
      winner = 'gecko';
      winnerName = 'CoinGecko';
    } else if (cmcTotal < geckoTotal) {
      winner = 'cmc';
      winnerName = 'CoinMarketCap';
    } else {
      winner = 'tie';
    }
    tieBreakerReason = 'both_enterprise';
  } else if (!cmcCost && geckoCost) {
    winner = 'gecko';
    winnerName = 'CoinGecko';
  } else if (!geckoCost && cmcCost) {
    winner = 'cmc';
    winnerName = 'CoinMarketCap';
  } else if (geckoCost && cmcCost) {
    if (geckoCost.total < cmcCost.total) {
      winner = 'gecko';
      winnerName = 'CoinGecko';
      absDollarSavings = cmcCost.total - geckoCost.total;
    } else if (cmcCost.total < geckoCost.total) {
      winner = 'cmc';
      winnerName = 'CoinMarketCap';
      absDollarSavings = geckoCost.total - cmcCost.total;
    } else {
      if (geckoTotal < cmcTotal) {
        winner = 'gecko';
        winnerName = 'CoinGecko';
      } else if (cmcTotal < geckoTotal) {
        winner = 'cmc';
        winnerName = 'CoinMarketCap';
      } else {
        winner = 'tie';
      }
      tieBreakerReason = 'same_cost';
    }
  }

  let creditLoserName = '';
  let creditLoserMultiplier = 1;
  let creditLoserDiff = 0;

  if (cmcTotal > geckoTotal && geckoTotal > 0) {
    creditLoserName = 'CoinMarketCap';
    creditLoserMultiplier = cmcTotal / geckoTotal;
    creditLoserDiff = cmcTotal - geckoTotal;
  } else if (geckoTotal > cmcTotal && cmcTotal > 0) {
    creditLoserName = 'CoinGecko';
    creditLoserMultiplier = geckoTotal / cmcTotal;
    creditLoserDiff = geckoTotal - cmcTotal;
  } else if (cmcTotal > 0 && geckoTotal === 0) {
    creditLoserName = 'CoinMarketCap';
    creditLoserMultiplier = Infinity;
    creditLoserDiff = cmcTotal;
  } else if (geckoTotal > 0 && cmcTotal === 0) {
    creditLoserName = 'CoinGecko';
    creditLoserMultiplier = Infinity;
    creditLoserDiff = geckoTotal;
  }

  const callsPaceLabel = 
    callsPerDay >= 86400 ? 'every 1s' : 
    callsPerDay >= 1440 ? `every ${Math.round(86400 / callsPerDay)}s` : 
    `${Math.round(callsPerDay / 24)}/hr`;

  return (
    <div className="bg-surface text-on-surface font-sans selection:bg-primary/20 selection:text-primary pt-8 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-6 mb-8 lg:mb-12">
          <div className="max-w-3xl">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-on-surface mb-3">
              CoinGecko vs CoinMarketCap API Credit & Cost Calculator
            </h1>
            <p className="text-on-surface-variant text-base lg:text-lg leading-relaxed">
              Configure your workload to measure and compare whether CoinGecko or CoinMarketCap API is the right fit for your budget and data requirements.
            </p>
          </div>

          <div className="flex bg-surface-container p-1 rounded-lg shrink-0 w-fit h-fit border border-border-subtle lg:mt-1 self-start">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${billing === 'monthly' ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('yearly')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 ${billing === 'yearly' ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              Yearly <span className="text-[10px] font-bold text-success-green uppercase bg-success-green/10 px-1.5 py-0.5 rounded">Save 20%</span>
            </button>
          </div>
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-12 gap-6 lg:gap-8">
          
          {/* Left Panel: Inputs */}
          <div className="col-span-12 lg:col-span-4 bg-surface-container-lowest border border-border-subtle rounded-xl p-6 shadow-sm h-fit">
            <div className="flex items-center gap-2 font-mono text-xs font-bold tracking-wider uppercase text-on-surface mb-6 bg-surface-container w-fit px-3 py-1.5 rounded-sm">
              <Settings2 className="w-4 h-4 text-on-surface-variant" />
              Your Workload
            </div>

            <div className="mb-6">
              <p className="font-mono text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2">What are you pulling?</p>
              <div className="flex bg-surface-container p-1 rounded-lg">
                <button
                  onClick={() => setWorkload('current')}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md ${workload === 'current' ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
                >
                  Live prices
                </button>
                <button
                  onClick={() => setWorkload('historical')}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md ${workload === 'historical' ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
                >
                  Historical
                </button>
                <button
                  onClick={() => setWorkload('both')}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md ${workload === 'both' ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
                >
                  Both
                </button>
              </div>
            </div>

            <label className="flex items-start gap-3 p-3 rounded-lg border border-border-subtle bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer mb-6 group">
              <input 
                type="checkbox" 
                checked={commercial} 
                onChange={(e) => setCommercial(e.target.checked)}
                className="mt-0.5 rounded border-border-subtle text-primary focus:ring-primary/20 bg-surface-container-lowest" 
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-on-surface group-hover:text-primary transition-colors">Commercial use</span>
                <span className="text-xs text-on-surface-variant/80">Limits plans to commercial-licensed tiers.</span>
              </div>
            </label>

            <hr className="border-t border-border-subtle my-6" />

            {showLive && (
              <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
                <div>
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="font-mono text-xs font-medium uppercase tracking-wide text-on-surface-variant">Tokens per call</span>
                    <span className="font-mono text-lg font-bold text-on-surface">{fmt(tokens)}</span>
                  </div>
                  <input type="range" min="10" max="1000" step="10" value={tokens} onChange={(e) => setTokens(Number(e.target.value))} className="w-full h-1 bg-surface-container-high rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface-container-lowest [&::-webkit-slider-thumb]:cursor-pointer cursor-ew-resize accent-primary" />
                  <div className="mt-2 flex justify-between text-[10px] uppercase font-mono text-on-surface-variant/70">
                    <span>10</span><span>1,000</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-baseline mb-2">
                     <span className="font-mono text-xs font-medium uppercase tracking-wide text-on-surface-variant">Currencies</span>
                    <span className="font-mono text-lg font-bold text-on-surface">{currencies}</span>
                  </div>
                  <input type="range" min="1" max="10" step="1" value={currencies} onChange={(e) => setCurrencies(Number(e.target.value))} className="w-full h-1 bg-surface-container-high rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface-container-lowest [&::-webkit-slider-thumb]:cursor-pointer cursor-ew-resize accent-primary" />
                  <div className="mt-2 flex justify-between text-[10px] uppercase font-mono text-on-surface-variant/70">
                    <span>1</span><span>10</span>
                  </div>
                </div>

                 <div>
                  <div className="flex justify-between items-baseline mb-2">
                     <span className="font-mono text-xs font-medium uppercase tracking-wide text-on-surface-variant">Calls per day</span>
                    <span className="font-mono text-lg font-bold text-on-surface">{fmt(callsPerDay)}</span>
                  </div>
                  <input type="range" min="100" max="86400" step="100" value={callsPerDay} onChange={(e) => setCallsPerDay(Number(e.target.value))} className="w-full h-1 bg-surface-container-high rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface-container-lowest [&::-webkit-slider-thumb]:cursor-pointer cursor-ew-resize accent-primary" />
                  <div className="mt-2 flex justify-between items-center text-[10px] uppercase font-mono text-on-surface-variant/70">
                    <span>100</span>
                    <span className="font-mono text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-sm">{callsPaceLabel}</span>
                    <span>86,400</span>
                  </div>
                </div>
              </div>
            )}

            {showLive && showHist && <hr className="border-t border-border-subtle my-6" />}

            {showHist && (
              <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
                <div>
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="font-mono text-xs font-medium uppercase tracking-wide text-on-surface-variant">Tokens w/ history</span>
                    <span className="font-mono text-lg font-bold text-on-surface">{fmt(histTokens)}</span>
                  </div>
                  <input type="range" min="0" max="15000" step="50" value={histTokens} onChange={(e) => setHistTokens(Number(e.target.value))} className="w-full h-1 bg-surface-container-high rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface-container-lowest [&::-webkit-slider-thumb]:cursor-pointer cursor-ew-resize accent-primary" />
                  <div className="mt-2 flex justify-between text-[10px] uppercase font-mono text-on-surface-variant/70">
                    <span>0</span><span>15,000</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-baseline mb-2">
                     <span className="font-mono text-xs font-medium uppercase tracking-wide text-on-surface-variant">Days of history</span>
                    <span className="font-mono text-lg font-bold text-on-surface">{fmt(histDays)}</span>
                  </div>
                  <input type="range" min="30" max="3650" step="10" value={histDays} onChange={(e) => setHistDays(Number(e.target.value))} className="w-full h-1 bg-surface-container-high rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface-container-lowest [&::-webkit-slider-thumb]:cursor-pointer cursor-ew-resize accent-primary" />
                  <div className="mt-2 flex justify-between items-center text-[10px] uppercase font-mono text-on-surface-variant/70">
                    <span>30D</span>
                     <span className="font-mono text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-sm">~{(histDays / 365).toFixed(1)} YRS</span>
                    <span>10Y</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-baseline mb-2">
                     <span className="font-mono text-xs font-medium uppercase tracking-wide text-on-surface-variant">Historical calls per day</span>
                    <span className="font-mono text-lg font-bold text-on-surface">{fmt(histCallsPerDay)}</span>
                  </div>
                  <input type="range" min="1" max="1440" step="1" value={histCallsPerDay} onChange={(e) => setHistCallsPerDay(Number(e.target.value))} className="w-full h-1 bg-surface-container-high rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface-container-lowest [&::-webkit-slider-thumb]:cursor-pointer cursor-ew-resize accent-primary" />
                  <div className="mt-2 flex justify-between items-center text-[10px] uppercase font-mono text-on-surface-variant/70">
                    <span>1</span>
                    <span className="font-mono text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-sm">
                      {histCallsPerDay >= 1440 ? 'every 1m' : `${Math.round(histCallsPerDay / 24)}/hr`}
                    </span>
                    <span>1,440</span>
                  </div>
                </div>

                <label className="flex items-start gap-3 p-3 rounded-lg border border-border-subtle bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={hourlyData} 
                    onChange={(e) => setHourlyData(e.target.checked)}
                    className="mt-0.5 rounded border-border-subtle text-primary focus:ring-primary/20 bg-surface-container-lowest" 
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-on-surface group-hover:text-primary transition-colors">Hourly granularity</span>
                    <span className="text-xs text-on-surface-variant/80">Requires specific plan tiers depending on the days of history needed.</span>
                  </div>
                </label>
              </div>
            )}
            
          </div>

          {/* Right Panel: Results */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
            
            {/* Pricing Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
              {/* CoinGecko Card */}
              <div className={`relative overflow-hidden rounded-xl p-6 border shadow-sm transition-colors duration-200 ${winner === 'gecko' ? 'bg-green-50 border-success-green' : 'bg-surface-container-lowest text-on-surface border-border-subtle'}`}>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-success-green" />
                    <span className="font-mono text-xs font-bold tracking-wider uppercase text-on-surface-variant">CoinGecko</span>
                  </div>
                  
                  <div className="font-sans text-5xl font-medium tracking-tight mb-1 text-on-surface">
                    {geckoCost ? fmtUSD(geckoCost.total) : 'Enterprise'}
                  </div>
                  <div className="text-xs text-on-surface-variant mb-6 font-mono tracking-wide uppercase">
                     {geckoCost ? `per month ${billing === 'yearly' ? '(billed yearly)' : ''}` : 'Custom quote required'}
                  </div>
                  
                  <div className={`space-y-2 pt-4 border-t ${winner === 'gecko' ? 'border-success-green/20' : 'border-border-subtle'}`}>
                     <div className="flex justify-between items-baseline text-sm">
                        <span className="text-on-surface-variant font-mono text-xs">Plan</span>
                        <span className="font-semibold text-on-surface">{geckoCost ? geckoPlan!.name : 'Enterprise'}</span>
                     </div>
                     <div className="flex justify-between items-baseline text-sm">
                        <span className="text-on-surface-variant font-mono text-xs">Base Price</span>
                        <span className="font-medium text-on-surface">{geckoCost ? fmtUSD(geckoCost.base) : '—'}</span>
                     </div>
                     {geckoCost && geckoCost.overage > 0 && (
                       <div className="flex justify-between items-baseline text-sm text-yellow-600">
                          <span className="font-mono text-xs">Overage ({fmt(geckoCost.overageCredits)})</span>
                          <span className="font-medium">+{fmtUSD(geckoCost.overage)}</span>
                       </div>
                     )}
                     <div className="flex justify-between items-baseline text-sm">
                        <span className="text-on-surface-variant font-mono text-xs">Monthly Credits</span>
                        <span className={`font-mono text-xs font-medium px-1.5 py-0.5 rounded text-on-surface ${winner === 'gecko' ? 'bg-success-green/10' : 'bg-surface-container'}`}>
                          {fmt(geckoTotal)} / {geckoPlan ? fmt(geckoPlan.credits) : '—'}
                        </span>
                     </div>
                  </div>
                </div>
              </div>

              {/* CoinMarketCap Card */}
              <div className={`relative overflow-hidden rounded-xl p-6 border shadow-sm transition-colors duration-200 ${winner === 'cmc' ? 'bg-blue-50 border-blue-400' : 'bg-surface-container-lowest text-on-surface border-border-subtle'}`}>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-error" />
                    <span className="font-mono text-xs font-bold tracking-wider uppercase text-on-surface-variant">CoinMarketCap</span>
                  </div>
                  
                  <div className="font-sans text-5xl font-medium tracking-tight mb-1 text-on-surface">
                    {cmcCost ? fmtUSD(cmcCost.total) : 'Enterprise'}
                  </div>
                  <div className="text-xs text-on-surface-variant mb-6 font-mono tracking-wide uppercase">
                     {cmcCost ? `per month ${billing === 'yearly' ? '(billed yearly)' : ''}` : 'Custom quote required'}
                  </div>
                  
                  <div className={`space-y-2 pt-4 border-t ${winner === 'cmc' ? 'border-blue-400/20' : 'border-border-subtle'}`}>
                     <div className="flex justify-between items-baseline text-sm">
                        <span className="text-on-surface-variant font-mono text-xs">Plan</span>
                        <span className="font-semibold text-on-surface">{cmcCost ? cmcPlan!.name : 'Enterprise'}</span>
                     </div>
                     <div className="flex justify-between items-baseline text-sm">
                        <span className="text-on-surface-variant font-mono text-xs">Base Price</span>
                        <span className="font-medium text-on-surface">{cmcCost ? fmtUSD(cmcCost.base) : '—'}</span>
                     </div>
                     {cmcCost && cmcCost.overage > 0 && (
                       <div className="flex justify-between items-baseline text-sm text-amber-700">
                          <span className="font-mono text-xs font-medium">Overage ({fmt(cmcCost.overageCredits)})</span>
                          <span className="font-semibold">+{fmtUSD(cmcCost.overage)}</span>
                       </div>
                     )}
                     <div className="flex justify-between items-baseline text-sm">
                        <span className="text-on-surface-variant font-mono text-xs">Monthly Credits</span>
                        <span className={`font-mono text-xs font-medium px-1.5 py-0.5 rounded text-on-surface ${winner === 'cmc' ? 'bg-blue-400/10' : 'bg-surface-container'}`}>
                          {fmt(cmcTotal)} / {cmcPlan ? fmt(cmcPlan.credits) : '—'}
                        </span>
                     </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Conversion Warning */}
            {cmcPlan && showLive && currencies > (cmcPlan.convPerCall ?? 1) && (
              <div className="flex gap-3 items-start bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-lg animate-in fade-in slide-in-from-bottom-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm leading-relaxed">
                  <strong>Heads up:</strong> Your {currencies}-currency call exceeds CoinMarketCap's <strong>{cmcPlan.name}</strong> plan limit of {cmcPlan.convPerCall} conversions per call. You'd need to upgrade tier or split the call.
                </p>
              </div>
            )}

            {/* Savings Box */}
            {(winner !== 'tie' || creditLoserName !== '') && (geckoTotal > 0 || cmcTotal > 0) && (
              <div className={`bg-gradient-to-br ${winner === 'gecko' ? 'from-green-100/50 to-surface-container-lowest border-success-green' : winner === 'cmc' ? 'from-blue-100 to-surface-container-lowest border-blue-400' : 'from-surface-container to-surface-container-lowest border-border-subtle'} border rounded-xl p-6 shadow-sm mb-6`}>
                <div className="mb-5">
                  <div className="font-mono text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Recommendation</div>
                  <div className="font-sans text-2xl font-bold text-on-surface">
                    {winner === 'tie' ? "Both cost the same" : `Choose ${winnerName}`}
                  </div>
                </div>
                
                {absDollarSavings > 0 && (
                  <div className="grid grid-cols-2 gap-4 mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm border bg-surface-container-lowest ${winner === 'gecko' ? 'border-green-200' : 'border-blue-200'}`}>
                        <span className={`font-sans text-2xl font-bold ${winner === 'gecko' ? 'text-success-green' : 'text-blue-500'}`}>$</span>
                      </div>
                      <div>
                        <div className="font-mono text-[10px] uppercase font-semibold text-on-surface-variant tracking-wider">Monthly Saving</div>
                        <div className="font-sans text-2xl font-bold text-on-surface leading-none mt-1">{fmtUSD(absDollarSavings)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm border bg-surface-container-lowest ${winner === 'gecko' ? 'border-green-200' : 'border-blue-200'}`}>
                        <ArrowUpRight className={`w-6 h-6 ${winner === 'gecko' ? 'text-success-green' : 'text-blue-500'}`} strokeWidth={3} />
                      </div>
                      <div>
                        <div className="font-mono text-[10px] uppercase font-semibold text-on-surface-variant tracking-wider">Annual Saving</div>
                        <div className="font-sans text-2xl font-bold text-on-surface leading-none mt-1">{fmtUSD(absDollarSavings * 12)}</div>
                      </div>
                    </div>
                  </div>
                )}

                {tieBreakerReason === 'same_cost' && (
                  <div className={`text-sm font-medium leading-relaxed bg-surface-container-lowest px-4 py-3 rounded-lg border shadow-sm inline-block ${winner === 'gecko' ? 'border-green-200 text-green-900' : 'border-blue-200 text-blue-900'}`}>
                    Both cost the same, however <strong>{winnerName}</strong> requires fewer credits, thus resulting in more effective queries available.
                  </div>
                )}

                {tieBreakerReason === 'both_enterprise' && (
                  <div className={`text-sm font-medium leading-relaxed bg-surface-container-lowest px-4 py-3 rounded-lg border shadow-sm inline-block ${winner === 'gecko' ? 'border-green-200 text-green-900' : 'border-blue-200 text-blue-900'}`}>
                    Both require a custom Enterprise plan, however <strong>{winnerName}</strong> requires fewer credits for this workload, offering better scale.
                  </div>
                )}

                {(!cmcCost || !geckoCost) && winner !== 'tie' && tieBreakerReason !== 'both_enterprise' && (
                  <div className={`text-sm font-medium leading-relaxed bg-surface-container-lowest px-4 py-3 rounded-lg border shadow-sm inline-block ${winner === 'gecko' ? 'border-green-200 text-green-900' : 'border-blue-200 text-blue-900'}`}>
                    {winner === 'gecko' ? 'CoinMarketCap requires a custom Enterprise quote for this workload.' : 'CoinGecko requires a custom Enterprise quote for this workload.'}
                  </div>
                )}

                {creditLoserName && (
                   <div className={`mt-5 pt-4 border-t ${winner === 'gecko' ? 'border-success-green/30' : winner === 'cmc' ? 'border-blue-400/30' : 'border-border-subtle'} text-sm text-on-surface-variant leading-relaxed`}>
                     For the same workload, {creditLoserName} uses <strong className="text-on-surface font-semibold">{creditLoserMultiplier === Infinity ? 'Infinity' : creditLoserMultiplier.toFixed(1)}× more credits</strong> ({fmt(creditLoserDiff)} more per month).
                   </div>
                )}

                {winner === 'gecko' && !geckoCost && (
                  <div className="mt-6 pt-5 border-t border-success-green/30">
                    <a 
                      href="https://www.coingecko.com/en/api/enterprise?utm_campaign=api-vs-articles&utm_source=cg-vs-cmc-api&utm_medium=learn-api&utm_term=contact-sales&utm_content=cost-calculator#form-section" 
                      target="_blank" 
                      rel="noreferrer" 
                      className="inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold text-white bg-success-green hover:bg-success-green/90 rounded-lg transition-colors w-full sm:w-auto shadow-sm"
                    >
                      Contact CoinGecko Sales Team
                      <ArrowUpRight className="ml-2 w-4 h-4" />
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* The Maths */}
            <div className="bg-surface-container-lowest border border-border-subtle rounded-xl overflow-hidden shadow-sm">
              <div className="bg-surface-container px-5 py-2.5 border-b border-border-subtle flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-on-surface-variant" />
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-on-surface">The Maths</span>
              </div>
              
              <div className="divide-y divide-border-subtle">
                {showLive && (
                  <div className="p-5">
                    <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-4">Live Prices</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-1">
                         <div className="flex items-center gap-1.5 text-sm font-semibold text-on-surface mb-2">
                            <CheckCircle2 className="w-4 h-4 text-success-green" /> CoinGecko
                         </div>
                         <div className="text-sm font-mono text-on-surface-variant pb-1">
                            {geckoLive.creditsPerCall} credit{geckoLive.creditsPerCall === 1 ? '' : 's'}/call × {fmt(callsPerDay * 30)} calls = <strong className="text-on-surface">{fmt(geckoLive.monthly)}</strong>
                         </div>
                         <div className="text-[11px] text-on-surface-variant/80 italic leading-snug">
                           {tokens} tokens {tokens > 500 && `(paginated: ${geckoLive.physicalCalls} calls of 500)`}, {currencies} {currencies > 1 ? 'currencies' : 'currency'} — flat 1 credit per physical call
                         </div>
                      </div>
                       <div className="space-y-1">
                         <div className="flex items-center gap-1.5 text-sm font-semibold text-on-surface mb-2">
                            <XCircle className="w-4 h-4 text-error" /> CoinMarketCap
                         </div>
                         <div className="text-sm font-mono text-on-surface-variant pb-1">
                            {cmcLive.creditsPerCall} credit{cmcLive.creditsPerCall === 1 ? '' : 's'}/call × {fmt(callsPerDay * 30)} calls = <strong className="text-on-surface">{fmt(cmcLive.monthly)}</strong>
                         </div>
                         <div className="text-[11px] text-on-surface-variant/80 italic leading-snug">
                           {tokens} × {currencies} = {fmt(cmcLive.dataPoints)} data points ÷ 100 (rounded up)
                         </div>
                      </div>
                    </div>
                  </div>
                )}

                {showHist && histTokens > 0 && (
                  <div className="p-5 bg-surface-container-lowest/50">
                    <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-4">Historical Data</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-1">
                         <div className="flex items-center gap-1.5 text-sm font-semibold text-on-surface mb-2">
                            <CheckCircle2 className="w-4 h-4 text-success-green" /> CoinGecko
                         </div>
                         <div className="text-sm font-mono text-on-surface-variant pb-1">
                            {geckoHistCallsPerToken} credit{geckoHistCallsPerToken === 1 ? '' : 's'} × {fmt(histTokens)} tokens × {fmt(histCallsPerDay)} call{histCallsPerDay > 1 ? 's' : ''}/day × 30 days = <strong className="text-on-surface">{fmt(geckoHist)}</strong>
                         </div>
                         <div className="text-[11px] text-on-surface-variant/80 italic leading-snug">
                           {hourlyData ? `⌈${histDays} days / 100⌉ calls per token` : 'Full series in one call'}
                         </div>
                      </div>
                       <div className="space-y-1">
                         <div className="flex items-center gap-1.5 text-sm font-semibold text-on-surface mb-2">
                            <XCircle className="w-4 h-4 text-error" /> CoinMarketCap
                         </div>
                         <div className="text-sm font-mono text-on-surface-variant pb-1">
                            {cmcPerHistToken} credit{cmcPerHistToken === 1 ? '' : 's'} × {fmt(histTokens)} tokens × {fmt(histCallsPerDay)} call{histCallsPerDay > 1 ? 's' : ''}/day × 30 days = <strong className="text-on-surface">{fmt(cmcHist)}</strong>
                         </div>
                         <div className="text-[11px] text-on-surface-variant/80 italic leading-snug">
                           ⌈{hourlyData ? `${histDays} days × 24 hrs` : `${histDays} days`} / 100⌉ credits per token
                         </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 pb-8 border-t border-border-subtle">
           <div className="w-full text-sm space-y-4 text-on-surface-variant/90 leading-relaxed text-justify">
              <p>
                For Enterprise needs, custom commercial terms, redistribution licences, or higher SLA requirements, <a href="https://www.coingecko.com/en/api/enterprise?utm_campaign=api-vs-articles&utm_source=cg-vs-cmc-api&utm_medium=learn-api&utm_term=contact-sales&utm_content=cost-calculator#form-section" target="_blank" rel="noreferrer" className="text-success-green hover:underline font-semibold">contact CoinGecko Sales team</a>.
              </p>
           </div>
        </div>

      </div>
    </div>
  );
}
