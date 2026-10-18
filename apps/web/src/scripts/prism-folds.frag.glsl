#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
out vec4 outColor;
const vec3 BG = vec3(20.0,21.0,27.0)/255.0;
const vec3 SILVER = vec3(194.0,197.0,219.0)/255.0;
const vec3 VIOLET = vec3(97.0,83.0,183.0)/255.0;
const vec3 MAGENTA = vec3(240.0,71.0,254.0)/255.0;
const vec3 YELLOW = vec3(230.0,220.0,106.0)/255.0;
float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p) {
  vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);
}
float fbm(vec2 p) {
  float v=0.0,a=0.5;
  for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+vec2(7.1,3.7);a*=0.5;}
  return v;
}
mat2 rotate(float a) { return mat2(cos(a),-sin(a),sin(a),cos(a)); }
vec3 brand(float x) {
  x=clamp(x,0.0,1.0);
  if(x<0.4) return mix(SILVER,VIOLET,x/0.4);
  if(x<0.78) return mix(VIOLET,MAGENTA,(x-0.4)/0.38);
  return mix(MAGENTA,YELLOW,(x-0.78)/0.22);
}
// Original domfx design study 10: Prism folds.

vec3 effect(vec2 uv, float t) {
  vec2 p = uv - 0.5;
  p.x *= uResolution.x / uResolution.y;
  float drift = sin(t * 0.1) * 0.035;
  vec3 color = BG;
  for (int i = 0; i < 4; i++) {
    float index = float(i);
    vec2 q = rotate(0.4 + index * 1.57) * p;
    q.x -= 0.66 + drift * sin(index + 1.0);
    float plane = max(-q.x - 0.19, abs(q.y) - (0.31 - q.x * 0.56));
    float inside = 1.0 - smoothstep(-0.004, 0.004, plane);
    float edge = exp(-abs(plane) * 140.0);
    float refracted = sin((q.x + q.y * 0.36) * 9.0 + index) * 0.5 + 0.5;
    vec3 glass = mix(BG, brand(refracted), 0.13);
    glass += SILVER * pow(refracted, 12.0) * 0.07;
    color = mix(color, glass, inside * 0.8);
    color += brand(index * 0.24 + q.y * 0.18) * edge * 0.38;
  }
  return color;
}
void main() {
  vec2 uv=gl_FragCoord.xy/uResolution;
  vec3 color=clamp(effect(uv,uTime),0.0,1.0);
  outColor=vec4(color,1.0);
}
