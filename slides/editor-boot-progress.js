/* editor-boot-progress.js — barre de progression du bootstrap éditeur.
   Extrait de editor.html (chantier 8 : plus de <script> inline → CSP script-src 'self'). */
(function(){
    var loaded=0, TOTAL=76;   // valeur de repli ; remplacée par le total réel annoncé par le bootstrap
    window.addEventListener('oei:editor-bootstrap-start',function(e){
        var t=e&&e.detail&&Number(e.detail.total);
        if(t>0) TOTAL=t;
    });
    window.addEventListener('oei:editor-bootstrap-progress',function(){
        loaded++;
        var b=document.getElementById('sl-boot-bar');
        if(b) b.style.width=Math.min(Math.round(loaded/TOTAL*100),99)+'%';
    });
    window.addEventListener('oei:editor-bootstrap-ready',function(){
        var b=document.getElementById('sl-boot-bar');
        if(b) b.style.width='100%';
        var w=document.getElementById('sl-boot-wrap');
        if(w){w.style.opacity='0';setTimeout(function(){w.remove();},350);}
        document.body.classList.remove('is-loading');
    });
})();
