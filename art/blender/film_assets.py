"""Extract each shot from Jade's film and build a single-decoder movie atlas."""
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
PUBLIC = HERE.parents[1] / 'public'
SRC = PUBLIC / 'videos/sous-la-peau-web.mp4'
OUT = PUBLIC / 'worlds'
CACHE = HERE / 'frames'
TIMES = [0, 1, 2, 3, 4, 5, 6, 6.91]

def ff(*args):
    subprocess.run(['ffmpeg','-loglevel','error','-y',*map(str,args)],check=True)

def main():
    CACHE.mkdir(exist_ok=True)
    OUT.mkdir(exist_ok=True)
    inputs = []
    for i, t in enumerate(TIMES):
        ff('-ss',t+.32,'-i',SRC,'-frames:v',1,'-vf','scale=640:360','-q:v',3,CACHE/f'shot{i}.jpg')
        inputs += ['-ss',str(t),'-t','1','-i',str(SRC)]
    for width,height,name in [(640,360,"film-huit-plans.mp4"),(960,540,"film-huit-plans-hd.mp4")]:
        filters = [f'[{i}:v]scale={width}:{height},fps=24,tpad=stop_mode=clone:stop_duration=0.1,trim=end_frame=24,setpts=PTS-STARTPTS[s{i}]' for i in range(8)]
        tiles = '|'.join(f'{width*(i%4)}_{height*(i//4)}' for i in range(8))
        filters.append(''.join(f'[s{i}]' for i in range(8))+f'xstack=inputs=8:layout={tiles},split[a][b]')
        filters += ['[b]reverse,setpts=PTS-STARTPTS[rev]','[a][rev]concat=n=2:v=1:a=0[loop]']
        ff(*inputs,'-filter_complex',';'.join(filters),'-map','[loop]','-an','-c:v','libx264','-crf',19,'-pix_fmt','yuv420p','-movflags','+faststart',OUT/name)

if __name__=='__main__':
    main()

