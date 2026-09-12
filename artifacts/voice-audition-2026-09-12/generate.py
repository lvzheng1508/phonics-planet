import subprocess,pathlib,json,hashlib
out=pathlib.Path(__file__).resolve().parent
voices=[('A','Daniel'),('B','Flo (英语（英国）)'),('C','Reed (英语（英国）)')]
words=[('short','was'),('medium','village'),('long','gingerbread house')]
records=[]
for length,word in words:
 for code,voice in voices:
  target=out/f'{length}-{code}.wav'
  subprocess.run(['/usr/bin/say','-v',voice,'-r','115','--file-format=WAVE','--data-format=LEI16@22050','-o',str(target),word+'.'],check=True,timeout=25)
  info=json.loads(subprocess.check_output(['/usr/local/bin/ffprobe','-v','error','-show_entries','format=duration','-of','json',str(target)]))
  assert float(info['format']['duration'])>0.2
  records.append(dict(word=word,length=length,style=code,voice=voice,rateWpm=115,file=target.name,duration=float(info['format']['duration']),sha1=hashlib.sha1(target.read_bytes()).hexdigest(),source='macOS system speech synthesis',locale='en_GB',license='local-preview-only; distribution rights not established',reviewStatus='pending'))
  print(word,code,info['format']['duration'],flush=True)
 # One comparison per word; equal leading/trailing padding separates candidates.
 args=[]
 for code,_ in voices: args+=['-i',str(out/f'{length}-{code}.wav')]
 filters=';'.join(f'[{i}:a]adelay=250,apad=pad_dur=1[a{i}]' for i in range(3))+';[a0][a1][a2]concat=n=3:v=0:a=1[out]'
 subprocess.run(['/usr/local/bin/ffmpeg','-nostdin','-y','-v','error',*args,'-filter_complex',filters,'-map','[out]','-c:a','pcm_s16le',str(out/f'{length}-ABC.wav')],check=True)
(out/'manifest.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
