"""Assess the predeclared sustained tail; retain and report the complete trace."""
import json
import math
import statistics
import sys
from datetime import datetime
from pathlib import Path

base = Path('docs/visual/perf')
directory = base / (sys.argv[1] if len(sys.argv) > 1 else 'local-rtx2060-thermal')
name = sys.argv[2] if len(sys.argv) > 2 else 'candidate-continuous-720'
data = json.loads((directory / f'{name}.json').read_text())
telemetry = [json.loads(line) for line in (directory / 'telemetry.jsonl').read_text().splitlines()]


def epoch(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp()


def dist(values):
    ordered = sorted(v for v in values if v is not None and math.isfinite(v))
    at = lambda p: ordered[max(0, math.ceil(len(ordered) * p) - 1)] if ordered else None
    return dict(count=len(ordered), p50=at(.5), p95=at(.95), p99=at(.99), max=at(1))


def bounded(value, maximum):
    return value is not None and value <= maximum


def slope_per_minute(points, key):
    if len(points) < 2:
        return None
    xs = [(epoch(p['at']) - start) / 60 for p in points]
    ys = [key(p) for p in points]
    mx, my = statistics.mean(xs), statistics.mean(ys)
    denom = sum((x - mx) ** 2 for x in xs)
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / denom if denom else None


start = epoch(data['measurementStartedAt'])
duration = data['options']['seconds']
tail_start = duration - 180
points = [p for p in telemetry if p['run'] == name and 0 <= epoch(p['at']) - start < duration]
tail_points = [p for p in points if epoch(p['at']) - start >= tail_start]
windows = []
for lo in range(tail_start, duration, 60):
    rows = [r for r in data['samples'] if lo <= r['t'] < lo + 60]
    sensor = [p for p in points if lo <= epoch(p['at']) - start < lo + 60]
    metrics = {key: dist(r[key] for r in rows) for key in ('cpuSubmitMs', 'gpuMs', 'rafMs')}
    bins = []
    for t in range(lo, lo + 60, 10):
        subset = [r for r in rows if t <= r['t'] < t + 10]
        bins.append({key: dist(r[key] for r in subset) for key in metrics})
    worst = {key: max((b[key]['p95'] for b in bins if b[key]['p95'] is not None), default=None)
             for key in metrics}
    temperatures = [p['gpu']['temperatureC'] for p in sensor]
    coverage = metrics['gpuMs']['count'] / len(rows) if rows else 0
    checks = dict(
        spansMinute=bool(rows) and rows[0]['t'] < lo + .1 and rows[-1]['t'] >= lo + 59.9,
        allTenSecondBins=all(b['cpuSubmitMs']['count'] and b['gpuMs']['count'] and b['rafMs']['count'] for b in bins),
        cpu=bounded(worst['cpuSubmitMs'], 1000 / 60 * .8),
        gpu=bounded(worst['gpuMs'], 1000 / 60 * .8),
        pacing=bounded(worst['rafMs'], 1000 / 60 + .25) and bounded(metrics['rafMs']['p99'], 25),
        stalls=bounded(metrics['rafMs']['max'], 50),
        gpuCoverage=coverage >= .99,
        telemetryCoverage=len(sensor) >= 55,
    )
    windows.append(dict(seconds=[lo, lo + 60], metrics=metrics, worstTenSecondP95=worst,
                        gpuCoverage=coverage, telemetryCount=len(sensor),
                        temperatureMedian=statistics.median(temperatures) if temperatures else None,
                        temperatureRange=[min(temperatures), max(temperatures)] if temperatures else None,
                        graphicsMHzMedian=statistics.median(p['gpu']['graphicsMHz'] for p in sensor) if sensor else None,
                        checks=checks, passAll=all(checks.values())))

medians = [w['temperatureMedian'] for w in windows if w['temperatureMedian'] is not None]
span = max(medians) - min(medians) if len(medians) == 3 else None
slope = slope_per_minute(tail_points, lambda p: p['gpu']['temperatureC'])
trends = {}
for key in ('cpuSubmitMs', 'gpuMs'):
    previous, last = windows[-2]['metrics'][key]['p95'], windows[-1]['metrics'][key]['p95']
    trends[key] = (last / previous - 1) * 100 if previous and last is not None else None
gaps = [epoch(b['at']) - epoch(a['at']) for a, b in zip(tail_points, tail_points[1:])]
endpoint_gaps = [epoch(tail_points[0]['at']) - start - tail_start,
                 start + duration - epoch(tail_points[-1]['at'])] if tail_points else []
all_gaps = gaps + endpoint_gaps
anchor_duration = epoch(data['measurementEndedAt']) - start
checks = dict(
    complete=not data['aborted'] and data['measuredWallSeconds'] >= duration - .1,
    valid=not data['invalidReasons'] and not data['timing']['hiddenEvents'] and not data['timing']['disjointEvents'],
    errors=not data['external']['errors'] and data['external']['stopReason'] is None,
    gpuCoverage=data['timing']['gpuCoverage'] >= .99 and data['timing']['unresolvedQueries'] == 0,
    cleanup=data['cleanupMemory'] == data['memory']['rendererBefore'],
    fullHD=data['renderer']['drawingBuffer'] == [1920, 1080],
    allTailWindows=all(w['passAll'] for w in windows),
    temperatureMedianSpan=bounded(span, 1),
    temperatureSlope=bounded(slope, .2),
    cpuTrend=bounded(trends['cpuSubmitMs'], 5),
    gpuTrend=bounded(trends['gpuMs'], 5),
    telemetryContinuity=bool(gaps) and len(endpoint_gaps) == 2 and max(all_gaps) <= 3,
    utcAnchors=abs(anchor_duration - data['measuredWallSeconds']) <= .002,
)
out = dict(
    run=directory.name, id=name, passAll=all(checks.values()), checks=checks,
    criteria=dict(tailSeconds=180, worstTenSecondCpuGpuP95=1000/60*.8, rafP95=1000/60+.25,
                  rafP99=25, maxRaf=50, minimumGpuCoverage=.99, maximumMedianTemperatureSpanC=1,
                  maximumTemperatureSlopeCPerMinute=.2, maximumLastMinuteCostIncreasePercent=5),
    tailWindows=windows, medianTemperatureSpanC=span, temperatureSlopeCPerMinute=slope,
    lastMinuteCostChangePercent=trends, maxTailTelemetryGapSeconds=max(all_gaps) if all_gaps else None,
    tailTelemetryEndpointGapsSeconds=endpoint_gaps, utcAnchorDurationSeconds=anchor_duration,
    completeRunSummary=data['summary'],
    measuredTelemetry=dict(samples=len(points), temperatureMax=max((p['gpu']['temperatureC'] for p in points), default=None),
                           vramUsedPeakMiB=max((p['gpu']['usedMiB'] for p in points), default=None),
                           vramFreeMinMiB=min((p['gpu']['freeMiB'] for p in points), default=None),
                           systemFreeRamMinMiB=min((p['availableRam']/1024**2 for p in points), default=None)),
    limitation='The scored tail is explicitly selected in advance. Complete-run samples and spikes remain above and in raw evidence. This is bounded sustained stability under measured conditions, not a universal machine maximum.',
)
(directory / 'THERMAL-ASSESSMENT.json').write_text(json.dumps(out, indent=2), encoding='utf-8')
print(json.dumps({k: v for k, v in out.items() if k not in ('completeRunSummary', 'tailWindows')}, indent=2))
