import { useId, useRef, useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';

export function HelpTip({text,label='规则说明',children}:{text:string;label?:string;children?:ReactNode}) {
  const id=useId();
  const anchor=useRef<HTMLSpanElement>(null);
  const [open,setOpen]=useState(false);
  const [pinned,setPinned]=useState(false);
  const [position,setPosition]=useState({left:12,top:12,width:320});
  if(!text) return <>{children}</>;
  const show=()=>{
    const rect=anchor.current?.getBoundingClientRect();
    if(!rect) return;
    const width=Math.min(340,window.innerWidth-24);
    const height=Math.min(240,window.innerHeight-24);
    setPosition({width,left:Math.max(12,Math.min(rect.left,window.innerWidth-width-12)),top:rect.bottom+height+8<window.innerHeight?rect.bottom+8:Math.max(12,rect.top-height-8)});
    setOpen(true);
  };
  const toggle=()=>{if(pinned){setPinned(false);setOpen(false);}else{setPinned(true);show();}};
  return <span ref={anchor} className={`help-tip${children?' help-tip-value':''}`} role="button" tabIndex={0} aria-label={label} aria-expanded={open} aria-describedby={open?id:undefined}
    onMouseEnter={show} onMouseLeave={()=>{if(!pinned)setOpen(false);}} onFocus={show} onBlur={()=>{setOpen(false);setPinned(false);}}
    onClick={event=>{event.preventDefault();event.stopPropagation();toggle();}}
    onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setOpen(false);setPinned(false);}if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();toggle();}}}>
    {children??<Info size={13}/>}
    {open && <span id={id} role="tooltip" className="help-tip-content" style={position}>{text}</span>}
  </span>;
}
