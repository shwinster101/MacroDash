// ─── FEAR & GREED GAUGE (UI-OVERHAUL wave 9) ────────────────────────────────
// Moved VERBATIM from dashboard.jsx.
import { T } from "../design-tokens.js";
import { Label } from "./atoms.jsx";
import SourceBox from "./SourceBox.jsx";

const FGGauge=({score,label,mode="MOCK",asOf})=>{
  const pct=score/100;
  const color=score<25?T.red:score<45?T.yellow:score<55?T.textSecondary:score<75?T.green:"#27ae60";
  const angle=-135+pct*270;
  return(
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:5,padding:"10px 12px",textAlign:"center"}}>
      <Label>Fear & Greed</Label>
      <div style={{position:"relative",width:80,height:48,margin:"4px auto 0"}}>
        <svg viewBox="0 0 80 48" style={{width:"100%",height:"100%"}}>
          <path d="M8,44 A36,36 0 0,1 72,44" fill="none" stroke={T.border} strokeWidth={6} strokeLinecap="round"/>
          <path d="M8,44 A36,36 0 0,1 72,44" fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" strokeDasharray={`${pct*113} 113`}/>
          <line x1="40" y1="44" x2={40+30*Math.cos((angle-90)*Math.PI/180)} y2={44+30*Math.sin((angle-90)*Math.PI/180)} stroke={T.textSecondary} strokeWidth={1.5} strokeLinecap="round"/>
          <circle cx="40" cy="44" r="3" fill={T.textSecondary}/>
        </svg>
      </div>
      <div style={{fontFamily:T.fontMono,fontSize:20,color,fontWeight:700}}>{score}</div>
      <div style={{fontFamily:T.fontMono,fontSize:9,color:T.textSecondary}}>{label}</div>
      <SourceBox api="CNN" endpoint="fear-and-greed-index" mode={mode} asOf={asOf}/>
    </div>
  );
};
export default FGGauge;
