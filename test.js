const raw = 'hook: <h2>...</h2><p>**zorganizowany w ka¿dej sekundzie**</p>'; console.log(raw.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>'));
