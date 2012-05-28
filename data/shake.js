/*This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at http://mozilla.org/MPL/2.0/.*/

self.port.on('shake', function()
{
    for (let i=10; i>0; i--)
        let (x=i) { setTimeout(function() { document.body.style.MozTransform = 'rotate(' + (x%2==0?'-':'') + x + 'deg)'; }, (10-i)*100); }
    setTimeout(function() { document.body.style.MozTransform = ''; }, 1100);
});
