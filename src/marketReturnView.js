// The public return has its own date/baseline, independent of the daily quote.
export function ytdView(data,mode,date,today) {
  const year=Number(String(today).slice(0,4));
  const available=["LIVE","CACHED"].includes(mode)&&Number.isFinite(data?.ytdTotal)&&
    /^\d{4}-\d{2}-\d{2}$/.test(date||"")&&date.startsWith(String(year))&&date<=today&&
    new RegExp("^"+(year-1)+"-12-\\d{2}$").test(data?.ytdTotalBase||"");
  return {available,value:available?data.ytdTotal:null,date:available?date:null};
}
