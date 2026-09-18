// Shared hierarchy: section titles are readable labels, not micro-eyebrows.
import { T } from "../design-tokens.js";
export default function SectionHeader({children,major=false}) {
  const Tag=major?"h2":"div";
  return <Tag className={major?"section-title":"section-subtitle"} style={{fontFamily:T.fontMono,fontSize:major?T.fsBody:T.fsL,fontWeight:700,color:major?T.amber:T.textPrimary,letterSpacing:"0.06em",textTransform:"uppercase",margin:"0 0 10px",paddingBottom:8,borderBottom:`1px solid ${T.borderAccent||T.border}`}}>{children}</Tag>;
}
