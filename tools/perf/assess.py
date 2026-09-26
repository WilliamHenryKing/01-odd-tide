"""Apply the predeclared final criteria to every repetition; no outlier removal."""
import json
from pathlib import Path

base = Path('docs/visual/perf')
names = ['candidate-A1', 'candidate-A2', 'candidate-A3']
out = dict(criteria=dict(cpuAndGpuP95Ms=1000/60*.8, rafP95Ms=1000/60+.25, rafP99Ms=25, maxRafMs=50, minGpuCoverage=.99), runs=[])
for name in names:
    file = base / 'local-rtx2060-final' / f'{name}.json'
    if not file.exists():
        out['runs'].append(dict(id=name, passAll=False, missing=True))
        continue
    d = json.loads(file.read_text())
    worst = lambda metric: max(v[metric]['p95'] or 0 for v in d['segments'].values())
    checks = dict(
        completed=not d['aborted'] and d['measuredWallSeconds'] >= 59.9,
        valid=not d.get('invalidReasons') and not d['timing']['hiddenEvents'] and not d['timing']['disjointEvents'],
        errors=not d['external']['errors'],
        gpuSamples=d['timing']['gpuCoverage'] >= .99 and d['timing']['unresolvedQueries'] == 0,
        cpu=worst('cpuSubmitMs') <= 1000/60*.8,
        gpu=worst('gpuMs') <= 1000/60*.8,
        pacing=worst('rafMs') <= 1000/60+.25 and d['summary']['rafMs']['p99'] <= 25,
        stalls=d['summary']['rafMs']['max'] <= 50,
        resourceCleanup=d['cleanupMemory'] == d['memory']['rendererBefore'],
        fullHD=d['renderer']['drawingBuffer'] == [1920,1080],
    )
    out['runs'].append(dict(id=name, passAll=all(checks.values()), checks=checks,
                            worstSegmentCpuP95=worst('cpuSubmitMs'), worstSegmentGpuP95=worst('gpuMs'), worstSegmentRafP95=worst('rafMs'),
                            summary=d['summary']))
out['allThreePass'] = all(row['passAll'] for row in out['runs'])
(base/'FINAL-ASSESSMENT.json').write_text(json.dumps(out, indent=2), encoding='utf-8')
print(json.dumps({**out, 'runs': [{k:v for k,v in row.items() if k != 'summary'} for row in out['runs']]}, indent=2))
