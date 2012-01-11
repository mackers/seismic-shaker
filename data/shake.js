self.port.on('shake', function()
{
    for (let i=10; i>0; i--)
        let (x=i) { setTimeout(function() { document.body.style.MozTransform = 'rotate(' + (x%2==0?'-':'') + x + 'deg)'; }, (10-i)*100); }
    setTimeout(function() { document.body.style.MozTransform = ''; }, 1100);
});
