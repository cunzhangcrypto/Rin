import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export function Reward() {
  const [method, setMethod] = useState(''); // '', 'menu', 'ali', 'wx', 'trc', 'bep'
  const [mounted, setMounted] = useState(false);
  const [copyTip, setCopyTip] = useState('');

  // 💡 打赏配置信息 - 完全保留你的手动修改，不动
  const bepAddr = 'TLRi2gcqVmmgqtXBYyHuviLRxY2eeiuXk9';
  const trcAddr = '0x88f9908344E711bffcB95b26aeF54fe3d56b919B'; 

  useEffect(() => {
    setMounted(true);
    if (method !== '') {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [method]);

  // 💡 复制功能
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyTip('复制成功！');
      setTimeout(() => setCopyTip(''), 2000);
    });
  };

  if (!mounted) return null;

  const close = () => setMethod('');

  const ModalContent = (
    <div 
      className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      style={{ zIndex: 1000000, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      onClick={close}
    >
      <div 
        /* 💡 保持 max-w-[450px] 不变 */
        className="bg-white rounded-[2.5rem] w-full max-w-[450px] p-9 relative shadow-2xl animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={close} className="absolute right-6 top-6 text-gray-300 hover:text-gray-500 text-3xl font-light">✕</button>
        <h4 className="text-xl font-black text-center mb-8 text-gray-800 tracking-tight">感谢您的支持</h4>

        {method === '' || method === 'menu' ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setMethod('ali')} className="flex flex-col items-center py-7 border border-gray-50 rounded-2xl hover:bg-[#0f766e]/10 hover:border-[#0f766e]/30 transition-all gap-2 group">
                <img src="/assets/ali_icon.png" className="w-12 h-12 group-hover:scale-110 transition-transform object-contain" alt="Ali" />
                <span className="text-sm font-bold text-gray-500">支付宝</span>
              </button>
              <button onClick={() => setMethod('wx')} className="flex flex-col items-center py-7 border border-gray-50 rounded-2xl hover:bg-[#0f766e]/10 hover:border-[#0f766e]/30 transition-all gap-2 group">
                <img src="/assets/wx_icon.png" className="w-12 h-12 group-hover:scale-110 transition-transform object-contain" alt="Wx" />
                <span className="text-sm font-bold text-gray-500">微信支付</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setMethod('trc')} className="flex flex-col items-center py-6 border border-gray-50 rounded-2xl hover:bg-[#0f766e]/10 transition-all gap-2 group">
                <img src="/assets/bep_icon.png" className="w-10 h-10 group-hover:scale-110 transition-transform object-contain" alt="BEP20" />
                <span className="text-[11px] font-bold text-gray-400">USDT (BEP20)</span>
              </button>
              <button onClick={() => setMethod('bep')} className="flex flex-col items-center py-6 border border-gray-50 rounded-2xl hover:bg-[#0f766e]/10 transition-all gap-2 group">
                <img src="/assets/trc_icon.png" className="w-10 h-10 group-hover:scale-110 transition-transform object-contain" alt="TRC20" />
                <span className="text-[11px] font-bold text-gray-400">USDT (TRC20)</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center animate-in fade-in duration-200">
            {/* 💡 调大二维码容器：改为 w-80 h-80 (320px) 显大 */}
            <div className="w-83 h-83 bg-white rounded-3xl mb-6 border border-gray-50 flex items-center justify-center overflow-hidden shadow-inner">
              <img 
                src={
                  method === 'ali' ? '/assets/alipay.png' :
                  method === 'wx' ? '/assets/wechat.png' :
                  method === 'trc' ? '/assets/usdt.png' : '/assets/bep20.png'
                } 
                className="w-full h-full object-contain p-2" 
                alt="QR" 
              />
            </div>
            
            {(method === 'trc' || method === 'bep') && (
              /* 💡 调大地址栏：字体改为 text-sm (14px)，padding 加大 */
              <div className="w-full bg-gray-50 p-5 rounded-3xl mb-6 border border-gray-100 relative group/addr">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-mono text-gray-500 break-all leading-relaxed text-left">
                    {method === 'trc' ? trcAddr : bepAddr}
                  </span>
                  {/* 💡 原生 SVG 复制图标按钮 */}
                  <button 
                    onClick={() => handleCopy(method === 'trc' ? trcAddr : bepAddr)}
                    className="flex-shrink-0 text-teal-600 hover:bg-teal-50 p-2.5 rounded-xl transition-all active:scale-90"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  </button>
                </div>
                {copyTip && (
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs font-bold py-1.5 px-4 rounded-full shadow-lg animate-bounce">
                    {copyTip}
                  </div>
                )}
              </div>
            )}

            <button onClick={() => setMethod('menu')} className="text-gray-400 font-bold text-sm underline underline-offset-8">
              返回选择其他方式
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col items-center my-10 py-8 border-t border-gray-100">
      <button 
        onClick={() => setMethod('menu')}
       className="bg-gradient-to-r from-[#0f766e] to-[#134e4a] text-white px-12 py-4 rounded-full font-bold shadow-lg hover:shadow-[#0f766e]/30 hover:scale-105 active:scale-95 transition-all text-sm"
      >
        ❤️ 请村长喝杯咖啡
      </button>

      {method !== '' && createPortal(ModalContent, document.body)}
    </div>
  );
}
