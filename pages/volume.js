// The stored slot for midnight is 24. Display calendar hours in local-day order.
export const hours = Array.from({length:24}, (_, hour) => hour || 24);
export const hourLabel = slot => String(Number(slot) % 24).padStart(2, '0') + ':00';

export function volumeMatrix(rows, saved, jaw, slot) {
 const field = 'jaw_' + jaw;
 const levels = [4,3,2,1,0,-1,-2,-3,-4];
 const header = hours.map(hour => '<th scope="col">'+hourLabel(hour)+'</th>').join('');
 const body = levels.map(level => {
  const cells = hours.map(hour => {
   const value = rows[hour]?.[field];
   const marked = value != null && value !== '' && Number(value) === level;
   const changed = marked && String(value) !== String(saved[hour]?.[field]);
   const symbol = marked ? changed ? '○' : '×' : '';
   return '<td'+(Number(slot)===hour?' class="selected-hour"':'')+'>'+symbol+'</td>';
  }).join('');
  return '<tr><th scope="row">'+(level>0?'+'+level:level)+'</th>'+cells+'</tr>';
 }).join('');
 return '<table><caption>Jaw '+jaw+' · Posisi per jam (WIB)</caption><thead><tr><th>Posisi</th>'+header+'</tr></thead><tbody>'+body+'</tbody></table>';
}
