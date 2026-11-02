'use client';
import {type Group, loadColor, loadLabel, muscleStats, type Entry} from '@/lib/fitness';
export default function BodyMap({entries,days,now,side,selected,onSelect}:{entries:Entry[];days:number;now:string;side:'front'|'back';selected:Group|null;onSelect:(g:Group)=>void}){
 const stats=muscleStats(entries,days,now);
 const region=(id:Group,d:string)=>{const data=stats.find(g=>g.id===id)!;const fill=loadColor(data.last?data.load:null);return <path key={id+d} d={d} fill={fill} stroke={selected===id?'#ffffff':'#20252b'} strokeWidth={selected===id?2.5:1.4} className="muscle-region" role="button" tabIndex={0} aria-label={`${data.name}: индекс нагрузки ${loadLabel(data)}`} onClick={()=>onSelect(id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(id)}}}></path>};
 return <svg className="body-map" viewBox="0 0 240 450" aria-label={`Карта записанной нагрузки, вид ${side==='front'?'спереди':'сзади'}`}>
 <ellipse cx="120" cy="433" rx="52" ry="7" fill="#1b1e23"/>
 <path d="M106 61 104 78 87 85 75 86Q62 87 58 102L49 139 40 177 29 218Q25 230 31 234L39 232 41 221 45 228 50 225 53 206 65 171 71 147 83 127 88 156 85 188 83 215 88 257 93 300 92 329 98 380 99 404 91 418Q88 423 95 424L113 423 118 408 117 379 116 327 120 282 124 327 123 379 122 408 127 423 145 424Q152 423 149 418L141 404 142 380 148 329 147 300 152 257 157 215 155 188 152 156 157 127 169 147 175 171 187 206 190 225 195 228 199 221 201 232 209 234Q215 230 211 218L200 177 191 139 182 102Q178 87 165 86L153 85 136 78 134 61Z" fill="#292f37" stroke="#444c58" strokeWidth="1.2"/>
 <path d="M103 24Q120 11 137 24L140 40 136 60 125 70 115 70 104 60 100 40Z" fill="#444c58"/>
 {side==='front'?<>
 {region('shoulders','M82 89Q65 87 60 106L58 125 72 120 85 103Z')}{region('shoulders','M158 89Q175 87 180 106L182 125 168 120 155 103Z')}
 {region('chest','M87 94 115 88 118 96 118 126Q103 140 84 124L78 111Z')}{region('chest','M153 94 125 88 122 96 122 126Q137 140 156 124L162 111Z')}
 {region('biceps','M58 130 72 124 78 130 65 164 56 179 47 176Z')}{region('biceps','M182 130 168 124 162 130 175 164 184 179 193 176Z')}
 {region('forearms','M46 181 56 184 44 215 35 217Z')}{region('forearms','M194 181 184 184 196 215 205 217Z')}
 {region('core','M102 139 117 136 117 157 103 157Z')}{region('core','M123 136 138 139 137 157 123 157Z')}{region('core','M103 162 117 162 117 180 104 179Z')}{region('core','M123 162 137 162 136 179 123 180Z')}{region('core','M105 184 117 184 117 207 109 210Z')}{region('core','M123 184 135 184 131 210 123 207Z')}
 {region('core','M89 134 98 142 99 177 104 204 88 194Z')}{region('core','M151 134 142 142 141 177 136 204 152 194Z')}
 {region('legs','M86 220 104 224 116 249 111 291 103 306 94 291Z')}{region('legs','M154 220 136 224 124 249 129 291 137 306 146 291Z')}
 {region('legs','M107 225 117 232 117 265 112 281 113 248Z')}{region('legs','M133 225 123 232 123 265 128 281 127 248Z')}
 {region('calves','M96 322 107 315 112 327 108 374 102 393 98 364Z')}{region('calves','M144 322 133 315 128 327 132 374 138 393 142 364Z')}
 </>:<>
 {region('back','M105 81 118 79 118 117 98 108 83 94Z')}{region('back','M135 81 122 79 122 117 142 108 157 94Z')}
 {region('shoulders','M79 91Q64 88 59 107L58 126 72 122 87 108Z')}{region('shoulders','M161 91Q176 88 181 107L182 126 168 122 153 108Z')}
 {region('back','M85 112 117 123 117 193 105 202 93 174Z')}{region('back','M155 112 123 123 123 193 135 202 147 174Z')}
 {region('arms','M58 132 73 127 77 136 65 166 55 181 47 176Z')}{region('arms','M182 132 167 127 163 136 175 166 185 181 193 176Z')}
 {region('forearms','M46 185 55 187 43 215 35 217Z')}{region('forearms','M194 185 185 187 197 215 205 217Z')}
 {region('glutes','M88 204Q103 199 117 208L117 240Q106 255 86 240Z')}{region('glutes','M152 204Q137 199 123 208L123 240Q134 255 154 240Z')}
 {region('legs','M89 247 107 251 116 243 111 292 103 307 95 292Z')}{region('legs','M151 247 133 251 124 243 129 292 137 307 145 292Z')}
 {region('calves','M96 318 105 314 112 328 111 350 103 370 98 357Z')}{region('calves','M144 318 135 314 128 328 129 350 137 370 142 357Z')}
 </>}
 </svg>;
}
