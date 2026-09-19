import { T } from "../design-tokens.js";

// One render path for Simple and Degen. Do not accept a mode prop.
export default function HeroFace({ face }) {
  if (!face) return null;
  return <div className="hero-face" style={{fontFamily:T.fontSans,marginTop:4,lineHeight:1.35}}>
    <div className="hero-vote-tally" style={{fontSize:T.fsBody,color:T.textPrimary}}>{face.tally}</div>
    <div className="hero-action" style={{fontSize:T.fsL,color:T.textPrimary,marginTop:2}}>{face.action}</div>
    <div className="hero-engine-note" style={{fontSize:T.fsM,color:T.textMuted,marginTop:2}}>{face.engine}</div>
  </div>;
}
