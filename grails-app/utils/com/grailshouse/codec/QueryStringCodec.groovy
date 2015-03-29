/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package com.grailshouse.codec

/**
 *
 * @author pgr
 */
class QueryStringCodec {

    def static encode = { str ->
        def qArr = str.split('\\?')
        def qs = ''
        if (qArr.size() > 1) {
            def ampArr = qArr[1].replaceAll('&amp;', '&').split('&')
            ampArr.eachWithIndex { entry, i ->
                def eqArr = entry.split('=')
                qs += (i > 0 ? '&amp;' : '') + eqArr[0] + '=' + eqArr[1].encodeAsURL().replaceAll('\\+', '%20')
            }
        }
        if (qs) {
            qs = '?' + qs
        }
        qArr[0] + qs
    }

}

