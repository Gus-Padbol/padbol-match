import React, {useLayoutEffect, useRef} from 'react';

// Local presentation only. Typing never sends or translates a draft.
export default function CrmReplyTextarea({value, ...props}) {
  const ref=useRef(null);
  useLayoutEffect(()=>{
    const el=ref.current;if(!el)return;
    el.style.height='auto';
    el.style.height=`${Math.max(160,Math.min(el.scrollHeight,360))}px`;
  },[value]);
  return <textarea {...props} ref={ref} value={value} rows={7} translate="no" className={`crm-reply-textarea notranslate ${props.className||''}`}/>;
}
