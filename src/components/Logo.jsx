export default function Logo({ size = 'md', white = false }) {
  const sizes = {
    sm: { img: 28, text: 'text-lg' },
    md: { img: 36, text: 'text-xl' },
    lg: { img: 48, text: 'text-2xl' },
    xl: { img: 64, text: 'text-3xl' },
  }
  const s = sizes[size] || sizes.md

  return (
    <div className="flex items-center gap-2 select-none" dir="ltr">
      <img
        src="/app-icon.png"
        alt="ATHAR GPS"
        width={s.img}
        height={s.img}
        draggable={false}
        style={{ width:s.img, height:s.img, borderRadius: size === 'sm' ? 8 : 11 }}
      />
      <div className="flex flex-col leading-none">
        <span className={`font-bold ${s.text} ${white ? 'text-white' : 'text-slate-900'} tracking-tight`}>
          ATHAR <span className={`${white ? 'text-accent-400' : 'text-accent'}`}>GPS</span>
        </span>
        {size !== 'sm' && (
          <span className={`text-xs font-medium ${white ? 'text-white/60' : 'text-primary-300'}`}>
             Fleet intelligence
          </span>
        )}
      </div>
    </div>
  )
}
