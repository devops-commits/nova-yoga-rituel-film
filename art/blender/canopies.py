"""Woven vaulted shells streaked with the film's material at architectural scale."""
from math import sin,cos,pi
def gallery(g,x,y,span,length,height,mat,weft,side=False):
    def point(t,a):
        r=span*(.98+.09*sin(t*pi*2+.5)+.05*cos(a*3+t*2))
        return (x+r*cos(a)+.32*sin(t*3+a)*sin(a), y+length*(t-.5)+.38*cos(a*2+t), .12+height*sin(a)*(.94+.10*sin(t*4+a)))
    rows=[[point(j/36,.025+pi*.975*i/22) for j in range(37)] for i in range(23)]
    g.surface('Voûte textile projetée',rows,mat)
    for j in range(22):
        t=j/21
        g.tube('Nervure de chaîne',[point(max(0,min(1,t+.08*sin(i/24*pi*2))),.04+pi*.97*i/24) for i in range(25)],.024 if j%3 else .041,weft)
    for k in range(9):
        a=.08+pi*.94*k/8
        g.tube('Trame transversale',[point(j/32,a+.04*sin(j/32*pi*3+k)) for j in range(33)],.015,weft)

