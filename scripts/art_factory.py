#!/usr/bin/env python3
"""Blender source → candidate → technical checks → visual review → runtime."""
import argparse, datetime, hashlib, json, os, shutil, struct, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
IDS=['rifle','soldier','crate','container','barrel','barrier','truck','workbench','locker','radio','medkit','backpack','generator']

def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def read(path):return json.loads(Path(path).read_text())
def write(path,value):Path(path).write_text(json.dumps(value,indent=2)+'\n')
def blender():
    path=os.environ.get('BLENDER_BIN') or shutil.which('blender') or str(Path.home()/'.local/bin/blender')
    if not Path(path).exists():raise RuntimeError('Blender missing; set BLENDER_BIN to the Blender executable.')
    return path

def selected(value):
    assets=IDS if value=='all' else value.split(',')
    for asset in assets:
        if asset not in IDS:raise RuntimeError('Unknown asset: '+asset)
    return assets

def parse_glb(path):
    data=Path(path).read_bytes()
    if len(data)<20:raise RuntimeError('Truncated GLB: '+str(path))
    magic,version,length=struct.unpack_from('<4sII',data)
    if magic!=b'glTF' or version!=2 or length!=len(data):raise RuntimeError('Invalid GLB header: '+str(path))
    chunk_length,chunk_type=struct.unpack_from('<II',data,12)
    if chunk_type!=0x4E4F534A:raise RuntimeError('GLB missing JSON chunk')
    return json.loads(data[20:20+chunk_length])

def validate(assets):
    summaries=[]
    for asset in assets:
        path=ROOT/'assets/candidates'/f'{asset}.json'
        if not path.exists():raise RuntimeError('Candidate missing for '+asset+'; run build first.')
        meta=read(path); glb=ROOT/meta['candidate']; source=ROOT/meta['source']; preview=ROOT/meta['preview']
        errors=[]
        for target,field in [(glb,'outputSha256'),(source,'sourceSha256'),(preview,'previewSha256')]:
            if not target.exists() or sha(target)!=meta[field]:errors.append('Missing or modified '+str(target.relative_to(ROOT)))
        content=parse_glb(glb)
        triangles=sum(content['accessors'][p['indices']]['count']//3 for m in content.get('meshes',[]) for p in m['primitives'] if 'indices' in p)
        limit=15000 if asset=='soldier' else 18000 if asset=='truck' else 10000
        if triangles>limit:errors.append(f'Triangle budget {triangles}>{limit}')
        if triangles!=meta['triangles']:errors.append(f'Export/source triangle mismatch {triangles}!={meta["triangles"]}')
        primitive_count=sum(len(m['primitives']) for m in content.get('meshes',[]))
        if primitive_count>45:errors.append(f'Draw budget {primitive_count}>45')
        if any(d<=0 or d>15 for d in meta['dimensions'].values()):errors.append('Invalid meter dimensions')
        if len(content.get('materials',[]))>16:errors.append('Material budget exceeded')
        if not content.get('images'):errors.append('PBR base color textures missing')
        if glb.stat().st_size>8_000_000:errors.append('GLB exceeds 8MB budget')
        names=[n.get('name') for n in content.get('nodes',[])]
        required=['leg_l','leg_r','arm_l','arm_r'] if asset=='soldier' else ['optic','suppressor'] if asset=='rifle' else []
        if any(n not in names for n in required):errors.append('Missing articulation/attachment node')
        for buffer in content.get('buffers',[]):
            if 'uri' in buffer:errors.append('External buffer reference')
        for img in content.get('images',[]):
            if 'uri' in img:errors.append('External texture reference')
        meta['technicalValidation']={'passed':not errors,'at':now(),'triangles':triangles,'triangleBudget':limit,'primitives':primitive_count,'errors':errors}
        write(path,meta); summaries.append(meta)
        print(f'{asset}: {"PASS" if not errors else "FAIL"} — {triangles} triangles, {primitive_count} draw primitives, {glb.stat().st_size//1024} KiB')
        if errors:raise RuntimeError('; '.join(errors))
    manifest={'schemaVersion':1,'units':'meters','coordinates':{'up':'+Y','forward':'-Z','origin':'ground center; rifle grounded at bottom magazine'},'pipeline':'source > candidate > technical validation > recorded visual review > runtime','createdAt':now(),'assets':summaries}
    if assets==IDS:write(ROOT/'assets/candidates/manifest.json',manifest)
    return summaries

def contact_sheet():
    # Pillow is optional for builds; individual Blender renders always exist.
    try:from PIL import Image,ImageDraw,ImageFont
    except ImportError:
        if shutil.which('magick'):
            font=subprocess.check_output(['fc-match','-f','%{file}','sans'],text=True) if shutil.which('fc-match') else 'sans'
            command=['magick','montage','-background','#131819','-fill','#ccd7cf','-font',font,'-pointsize','18']
            for asset in IDS:
                path=ROOT/'assets/previews'/f'{asset}.png'
                if path.exists():command.extend(['-label',asset.upper(),str(path)])
            command.extend(['-thumbnail','320x320','-geometry','320x350+0+0','-tile','4x',str(ROOT/'assets/previews/contact-sheet.jpg')])
            subprocess.run(command,check=True);print('Contact sheet: assets/previews/contact-sheet.jpg')
        else:print('Pillow and ImageMagick unavailable: inspect individual assets/previews/*.png')
        return
    width=1280; tile=320; height=((len(IDS)+3)//4)*360
    result=Image.new('RGB',(width,height),(19,24,25));draw=ImageDraw.Draw(result)
    for index,asset in enumerate(IDS):
        path=ROOT/'assets/previews'/f'{asset}.png'
        if not path.exists():continue
        img=Image.open(path).convert('RGB').resize((tile,tile))
        x=(index%4)*tile; y=(index//4)*360
        result.paste(img,(x,y));draw.text((x+14,y+326),asset.upper(),fill=(204,215,207))
    result.save(ROOT/'assets/previews/contact-sheet.jpg',quality=92)
    print('Contact sheet: assets/previews/contact-sheet.jpg')

def review(args):
    if len(args.notes.strip())<25:raise RuntimeError('Record specific actual visual findings (at least 25 characters).')
    summaries=validate(selected(args.asset))
    for meta in summaries:
        record={'assetId':meta['id'],'decision':args.decision,'reviewer':args.reviewer,'notes':args.notes,'reviewedAt':now(),'outputSha256':meta['outputSha256'],'sourceSha256':meta['sourceSha256'],'previewSha256':meta['previewSha256'],'preview':meta['preview'],'technicalValidation':meta['technicalValidation']}
        archive=ROOT/'assets'/('reviewed' if args.decision=='approve' else 'rejected')/meta['id']/(meta['outputSha256'][:16]+'_'+meta['sourceSha256'][:16])
        archive.mkdir(parents=True,exist_ok=True)
        for key in ['candidate','source','preview']:shutil.copy2(ROOT/meta[key],archive/Path(meta[key]).name)
        record['snapshot']=str(archive.relative_to(ROOT))
        write(archive/'review.json',record)
        write(ROOT/'assets/reviews'/f'{meta["id"]}.json',record)
        meta['visualReview']=record;meta['status']='reviewed' if args.decision=='approve' else 'rejected'
        write(ROOT/'assets/candidates'/f'{meta["id"]}.json',meta)
        destination=ROOT/'assets'/('reviewed' if args.decision=='approve' else 'rejected')
        shutil.copy2(ROOT/meta['candidate'],destination/f'{meta["id"]}.glb')
        write(destination/f'{meta["id"]}.json',meta)
        print(meta['id']+': visual review '+args.decision)

def publish(assets):
    summaries=validate(assets)
    for meta in summaries:
        path=ROOT/'assets/reviews'/f'{meta["id"]}.json'
        if not path.exists():raise RuntimeError(meta['id']+': visual review required before publish')
        record=read(path)
        if record['decision']!='approve':raise RuntimeError(meta['id']+': visual review rejected')
        if any(record[k]!=meta[k] for k in ['sourceSha256','outputSha256','previewSha256']):raise RuntimeError(meta['id']+': candidate changed after review')
    (ROOT/'public/assets').mkdir(parents=True,exist_ok=True)
    runtime_path=ROOT/'public/assets/manifest.json'
    existing=read(runtime_path)['assets'] if runtime_path.exists() else []
    published={item['id']:item for item in existing}
    for meta in summaries:
        shutil.copy2(ROOT/meta['candidate'],ROOT/'public/assets'/f'{meta["id"]}.glb')
        meta['status']='published';meta['runtime']='/assets/'+meta['id']+'.glb';meta['publishedAt']=now();meta['visualReview']=read(ROOT/'assets/reviews'/f'{meta["id"]}.json')
        published[meta['id']]=meta
    write(runtime_path,{'schemaVersion':1,'units':'meters','up':'+Y','forward':'-Z','assets':list(published.values())})
    print(f'Published {len(summaries)} validated, visually approved assets to public/assets')

def main():
    parser=argparse.ArgumentParser(description=__doc__); sub=parser.add_subparsers(dest='command',required=True)
    for command in ['build','validate','publish']:
        p=sub.add_parser(command);p.add_argument('--asset',default='all')
    sub.add_parser('doctor');sub.add_parser('contact-sheet')
    p=sub.add_parser('review');p.add_argument('--asset',default='all');p.add_argument('--decision',choices=['approve','reject'],required=True);p.add_argument('--reviewer',required=True);p.add_argument('--notes',required=True)
    args=parser.parse_args()
    if args.command=='doctor':
        binary=blender();print('Blender: '+binary)
        result=subprocess.run([binary,'--version'],capture_output=True,text=True,timeout=30)
        print(result.stdout.splitlines()[0]);print('Factory: deterministic original procedural PBR GLB assets; no network or paid API required.')
        print('MCP: optional interactive authoring transport; this factory uses isolated Blender background processes.')
        return
    if args.command=='build':
        for folder in ['source','candidates','reviews','reviewed','rejected','previews']:(ROOT/'assets'/folder).mkdir(parents=True,exist_ok=True)
        compile((ROOT/'scripts/blender_assets.py').read_text(),str(ROOT/'scripts/blender_assets.py'),'exec')
        process=subprocess.run([blender(),'--background','--factory-startup','-noaudio','--threads','6','--python-exit-code','1','--python',str(ROOT/'scripts/blender_assets.py'),'--',*selected(args.asset)],cwd=ROOT)
        if process.returncode:raise RuntimeError(f'Blender build failed ({process.returncode})')
        validate(selected(args.asset));contact_sheet()
    elif args.command=='validate':validate(selected(args.asset))
    elif args.command=='review':review(args)
    elif args.command=='publish':publish(selected(args.asset))
    elif args.command=='contact-sheet':contact_sheet()

if __name__=='__main__':
    try:main()
    except (RuntimeError,FileNotFoundError,subprocess.TimeoutExpired) as exc:print('FACTORY ERROR: '+str(exc),file=sys.stderr);sys.exit(1)
