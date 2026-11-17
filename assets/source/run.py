import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
import assets

OUT = sys.argv[1]
names = sys.argv[2:] or list(assets.REG.keys())
RES = int(os.environ.get('RES', '1024'))
SAMPLES = int(os.environ.get('SAMPLES', '40'))
for n in names:
    grp, fn, yaw, pitch = assets.REG[n]
    t = time.time()
    try:
        reset()
        root = group()
        fn(root)
        make_scene(root, res=RES, samples=SAMPLES, yaw=yaw, pitch=pitch)
        d = os.path.join(OUT, grp)
        os.makedirs(d, exist_ok=True)
        render(os.path.join(d, n + '.png'))
        print('DONE', n, round(time.time() - t, 1), flush=True)
    except Exception as e:
        import traceback
        print('FAIL', n, repr(e), flush=True)
        traceback.print_exc()
