"""Summarise retained measurements without hiding failed or aborted stages."""
import json
from pathlib import Path

base = Path('docs/visual/perf')
rows = []
for directory in sorted(base.glob('local-*')):
    telemetry_path = directory / 'telemetry.jsonl'
    telemetry = [json.loads(line) for line in telemetry_path.read_text().splitlines()] if telemetry_path.exists() else []
    for file in sorted(directory.glob('*.json')):
        data = json.loads(file.read_text(encoding='utf-8-sig'))
        if 'summary' not in data:
            continue
        s = data['summary']
        observed = [t for t in telemetry if t['run'] == data['options']['id']]
        worst = lambda metric: max((v[metric]['p95'] or 0 for v in data['segments'].values()), default=0)
        row = dict(run=directory.name, id=data['options']['id'], schema=data['schema'], aborted=data['aborted'], buffer=data['renderer']['drawingBuffer'],
                   seconds=data['measuredWallSeconds'], frames=s['frames'], rafP95=s['rafMs']['p95'], rafP99=s['rafMs']['p99'], rafMax=s['rafMs']['max'],
                   cpuP95=s['cpuSubmitMs']['p95'], gpuP95=s['gpuMs']['p95'], worstCpuP95=worst('cpuSubmitMs'), worstGpuP95=worst('gpuMs'), worstRafP95=worst('rafMs'),
                   calls=s['drawCalls']['p95'], triangles=s['triangles']['p95'], texturePayloadMiB=data['memory']['stressTexturePayloadBytes']/1024**2,
                   gpuCoverage=data['timing']['gpuCoverage'], disjoint=data['timing']['disjointEvents'], hidden=data['timing']['hiddenEvents'],
                   over50=s['rafMs']['over50'], invalid=data.get('invalidReasons', []),
                   tempMax=max((t['gpu']['temperatureC'] for t in observed), default=None),
                   vramPeakMiB=max((t['gpu']['usedMiB'] for t in observed), default=None),
                   minFreeRamMiB=min((t['availableRam']/1024**2 for t in observed), default=None),
                   graphicsMHzRange=[min((t['gpu']['graphicsMHz'] for t in observed), default=None), max((t['gpu']['graphicsMHz'] for t in observed), default=None)],
                   errors=data['external'].get('errors', []), cleanup=data.get('cleanupMemory'), rendererBefore=data['memory'].get('rendererBefore'))
        rows.append(row)
(base/'SUMMARY.json').write_text(json.dumps(rows, indent=2), encoding='utf-8')
print('run/id | frame p95/p99/max | CPU/GPU p95 | calls / triangles | textureMiB | temp | aborted')
for r in rows:
    gpu = 'n/a' if r['gpuP95'] is None else f"{r['gpuP95']:.2f}"
    print(f"{r['run']}/{r['id']} | {r['rafP95']:.2f}/{r['rafP99']:.2f}/{r['rafMax']:.2f} | {r['cpuP95']:.2f}/{gpu} | {r['calls']} / {r['triangles']} | {r['texturePayloadMiB']:.0f} | {r['tempMax']} | {r['aborted']}")
