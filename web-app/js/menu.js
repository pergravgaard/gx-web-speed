function supportsSelector1(selector) {
    var el = document.createElement('div');
    el.innerHTML = ['&shy;', '<style>', selector, '{display:block}', '</style>'].join('');
    el = document.documentElement.appendChild(el);
    var style = el.getElementsByTagName('style')[0],
        ret = !!(style.sheet.rules || style.sheet.cssRules)[0];
    el.parentNode.removeChild(el);
    return ret;
}


function supportsSelector(selector, html, cssProps) {
    function hyphenate(s) {
        var rs = '';
        for (var i = 0, l = s.length; i < l; i++) {
            var ch = s[i], chl = ch.toLowerCase();
            if (ch != chl) {
                rs += '-';
            }
            rs += chl;
        }
        return rs;
    }
    var div = document.createElement('div');
    var id = 'div' + new Date().getTime();
    div.setAttribute('id', id);
    div.setAttribute('style', 'display:none');
    var htm = '<style type="text/css">#' + id + ' ' + selector + '{';
    for (var p in cssProps) {
        htm += hyphenate(p) + ':' + cssProps[p] + ';';
    }
    htm += '}</style>';
    div.innerHTML = htm + html;
    document.body.appendChild(div);
    var rs = true;
    var cStyle = getComputedStyle(div.lastElementChild);
    for (var p in cssProps) {
        if (cStyle[p] != cssProps[p]) {
            rs = false;
            break;
        }
    }
    div.parentNode.removeChild(div);
    return rs;
}


document.addEventListener('DOMContentLoaded', function() {
    var chbox = document.getElementById('menu-toggle');
    chbox.addEventListener('click', function(e) {
        //this.className = this.checked ? 'checked' : '';
//        var div = document.getElementById('divBodyContainer');
//        div.style.left = this.checked ? '200px' : '0';
    }, false);
//    out(':nth-child: ' + supportsSelector(':nth-child(odd)'));
//    out(':unsupported: ' + supportsSelector(':unsupported'));
//    out('::before: ' + supportsSelector('::before'));
//    out('::before: ' + supportsSelector('::before'));
    //out(':checked - ' + supportsSelector1(':checked'));
    //out(':checked: ' + supportsSelector('input:checked', '<input type="checkbox" checked="checked" />', {fontSize: '30px'}));

//    if (document.addEventListener) {
//        document.addEventListener('DOMContentLoaded', function() {
//            //alert(Modernizr.hasEvent('pointerdown', document));
//            var chbox = document.getElementById('menu-toggle');
//            alert(getComputedStyle(chbox).fontSize);
//            return
//
//            chbox.addEventListener('click', function(e) {
//                alert(12);
//            }, false);
//            if (window.CSS && window.CSS.supports && window.CSS.supports('transition', 'transition3d')) {
//                alert(2);
//            } else {
//                alert(3)
//            }
//        }, false);
//    }
}, false);