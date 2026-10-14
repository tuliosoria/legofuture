/** Browse only supplies asking prices. Matching is deliberately conservative. */
export function aggregateAskingListings(items, setNumber) {
  if (!/^\d{4,7}$/.test(setNumber)) return null;
  const exact = new RegExp(`(^|\\D)${setNumber}(?![\\d-])`);
  const prices = items.filter((item) => {
    const title=String(item.title ?? '');
    const candidateNumbers = title.match(/\b\d{4,7}\b/g) ?? [];
    if (candidateNumbers.some(number => number !== setNumber)) return false;
    return exact.test(title) && /\blego\b/i.test(title) && /\bsealed\b/i.test(title) && !/\b(used|incomplete|lot|lots|bundle|replica|compatible|instructions|manual|empty|box only|box-only|parts only|unsealed|opened|not|no|without|only|bags|bag)\b/i.test(title) && String(item.conditionId)==='1000' && item.price?.currency==='USD';
  }).map(item=>Number(item.price?.value)).filter(n=>Number.isFinite(n)&&n>0).sort((a,b)=>a-b);
  if (!prices.length) return null;
  const mid=Math.floor(prices.length/2);
  return { medianAskingPrice: prices.length%2 ? prices[mid] : (prices[mid-1]+prices[mid])/2, averageAskingPrice:prices.reduce((a,b)=>a+b,0)/prices.length, sampleSize:prices.length };
}
export function askingRows(setNumber, aggregate, observedAt) {
 const common={provider:'ebay',kind:'asking',productId:setNumber,currency:'USD',condition:'new-sealed',observedAt,fetchedAt:observedAt,matchEvidence:{exact:true,version:'lego-sealed-v1'},publicationAllowed:false,amount:aggregate.medianAskingPrice,...aggregate};
 return [{...common,pk:`HISTORY#PRODUCT#${setNumber}`,sk:`ebay-asking-v1#${observedAt}`},{...common,pk:`PRICING#PRODUCT#${setNumber}`,sk:'ebay-asking-v1'}];
}
export function activeCountUpdate(count, observedAt) {
 if (!Number.isSafeInteger(count) || count<0) return null;
 return {UpdateExpression:'SET activeListingCount = :v, ebayAskingObservedAt = :ts, ebayCountKind = :kind',ExpressionAttributeValues:{':v':count,':ts':observedAt,':kind':'asking-search-results'}};
}
