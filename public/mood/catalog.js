// An editorial starter collection. These are not the owner's ratings or learned clusters.
const rows = [
[1398,'Stalker',1979,'Andrei Tarkovsky',162,'Science Fiction', 'A guide leads two men through a forbidden industrial zone toward a room that may grant their deepest wishes. Slow spiritual science fiction, abandoned landscapes and unknowable forces.', 'slow contemplative existential surreal isolation atmospheric spiritual abandoned mystery',0],
[62,'2001: A Space Odyssey',1968,'Stanley Kubrick',149,'Science Fiction','An enigmatic monolith links human origins with a lonely space mission governed by an intelligent computer. Monumental images and cosmic dread.','space isolation artificial intelligence cosmic slow visual existential',0],
[593,'Solaris',1972,'Andrei Tarkovsky',167,'Science Fiction','A psychologist visits an isolated space station where an alien ocean materializes memories of lost loved ones.','space isolation grief memory alien slow contemplative surreal',0],
[185,'A Clockwork Orange',1971,'Stanley Kubrick',137,'Crime','A young violent delinquent undergoes an experimental treatment that raises questions about free will.','violent dystopian surreal satire disturbing intense visual',1],
[346,'Seven Samurai',1954,'Akira Kurosawa',207,'Drama','Farmers hire seven masterless samurai to defend their village against bandits.','community siege action humane epic black white',4],
[18148,'Tokyo Story',1953,'Yasujiro Ozu',136,'Drama','An elderly couple visit their grown children in Tokyo and confront the quiet distances within their family.','slow family humane contemplative grief everyday',4],
[832,'M',1931,'Fritz Lang',111,'Crime','A German city becomes consumed by a manhunt for a child murderer, drawing police and criminals into parallel searches.','crime urban paranoia black white thriller moral',3],
[10331,'Night of the Living Dead',1968,'George A. Romero',96,'Horror','Strangers barricade themselves inside a farmhouse as the dead rise outside.','zombies siege confined apocalypse black white social horror',2],
[1091,'The Thing',1982,'John Carpenter',109,'Horror','Antarctic researchers are trapped with an alien organism that can imitate any of them.','isolation antarctic snow confined alien paranoia body horror siege',2,'tzGY49kseSE9QAKk47uuDGwnSCu.jpg'],
[790,'The Fog',1980,'John Carpenter',89,'Horror','A coastal town is besieged by a supernatural fog carrying the vengeful dead.','siege coastal ghost supernatural atmosphere horror',2],
[348,'Alien',1979,'Ridley Scott',117,'Horror','A commercial spacecraft crew encounter a lethal organism far from any help.','space isolation confined alien industrial horror dread',2,'vfrQk5IPloGg1v9Rzbh2Eg3VGyM.jpg'],
[220,'East of Eden',1955,'Elia Kazan',118,'Drama','A restless young man struggles to earn his father’s love in California’s Salinas Valley.','family emotional americana humane coming age',4],
[443791,'Underwater',2020,'William Eubank',95,'Horror','Workers at a deep sea drilling station must cross the ocean floor after a catastrophic breach.','underwater isolation confined survival cosmic creature horror',2],
[157433,'Pet Sematary',2019,'Kevin Kölsch & Dennis Widmyer',101,'Horror','A grieving family discovers a burial ground with a terrible power to return the dead.','grief family supernatural horror dark',2],
[1018,'Mulholland Drive',2001,'David Lynch',147,'Mystery','An aspiring actress and an amnesiac woman follow an identity mystery through a dreamlike Los Angeles.','surreal dream identity hollywood mystery disturbing atmospheric',1],
[752,'V for Vendetta',2006,'James McTeigue',132,'Thriller','A masked revolutionary draws a young woman into resistance against a totalitarian state.','dystopian political rebellion thriller',3],
[1018+1000000,'Inland Empire',2006,'David Lynch',180,'Mystery','An actress loses the boundaries between her life and the role she is playing.','surreal dream identity experimental disturbing nonlinear',1],
[116745,'The Secret Life of Walter Mitty',2013,'Ben Stiller',114,'Adventure','A daydreaming picture editor leaves his routine behind to track down a missing photograph.','warm hopeful adventure travel uplifting visual',4],
[141,'Donnie Darko',2001,'Richard Kelly',114,'Science Fiction','A troubled teenager follows cryptic visions of a giant rabbit as time seems to fracture around him.','surreal time suburban existential dark coming age',1],
[264660,'Ex Machina',2015,'Alex Garland',108,'Science Fiction','A programmer visits a secluded home to evaluate a humanoid artificial intelligence.','artificial intelligence isolated confined manipulation architecture thriller',0,'dmJW8IAKHKxFNiUnoDR7JfsK7Rp.jpg'],
[301365,'The Neon Demon',2016,'Nicolas Winding Refn',118,'Horror','An aspiring model enters a seductive Los Angeles fashion world obsessed with youth and beauty.','neon visual disturbing surreal fashion intense horror',1],
[11645,'Ran',1985,'Akira Kurosawa',162,'Drama','An aging warlord divides his kingdom among his sons and unleashes a devastating struggle for power.','epic visual war family tragic color',5],
[12545,'Jesus Camp',2006,'Heidi Ewing & Rachel Grady',84,'Documentary','Children attend an evangelical summer camp centered on religious and political conviction.','documentary religion community unsettling observational',5],
[12162,'The Hurt Locker',2008,'Kathryn Bigelow',131,'War','An explosive ordnance team in Iraq operates under the pressure of constant danger.','war intense suspense documentary realism obsession',3],
[490,'The Seventh Seal',1957,'Ingmar Bergman',96,'Drama','A knight returning from the Crusades plays chess with Death during a plague.','black white existential spiritual mortality medieval slow',0],
[27205,'Inception',2010,'Christopher Nolan',148,'Science Fiction','A team enters shared dreams to plant an idea inside a target’s mind.','dream surreal architecture heist intense mind',1,'oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg'],
[120467,'The Grand Budapest Hotel',2014,'Wes Anderson',100,'Comedy','A concierge and his lobby boy become entangled in a disputed inheritance and a stolen painting.','warm whimsical visual colorful comedy nostalgic',4],
[152601,'Her',2013,'Spike Jonze',126,'Romance','A lonely writer falls in love with an operating system that develops its own consciousness.','melancholy romance artificial intelligence warm existential',0],
[146233,'Prisoners',2013,'Denis Villeneuve',153,'Thriller','A father takes desperate action after his daughter disappears while a detective pursues the case.','crime abduction moral dark rain intense suspense',3],
[1949,'Zodiac',2007,'David Fincher',157,'Crime','A cartoonist and journalists become consumed by the unsolved Zodiac murders.','crime true crime obsession procedural urban atmospheric',3],
[427,'Mon Oncle',1958,'Jacques Tati',117,'Comedy','Monsieur Hulot disrupts his relatives’ immaculate modern home with his unhurried ways.','architecture modernity visual comedy observational warm',5],
[10227,'PlayTime',1967,'Jacques Tati',124,'Comedy','Visitors and residents drift through a modern Paris of glass offices, trade exhibitions and a chaotic restaurant.','architecture modernity observational visual comedy city experimental',5],
[10644,'The Unbearable Lightness of Being',1988,'Philip Kaufman',171,'Drama','A surgeon and two women navigate love and political upheaval in Prague.','romance political existential contemplative',4],
[654,'On the Waterfront',1954,'Elia Kazan',108,'Drama','A dockworker faces the consequences of testifying against a corrupt waterfront union.','working class crime humane moral black white',4],
[10774,'Network',1976,'Sidney Lumet',121,'Drama','A television network turns an anchor’s breakdown into a profitable spectacle.','media satire capitalism disturbing urban',3],
[570,'Dancer in the Dark',2000,'Lars von Trier',140,'Drama','A factory worker losing her sight finds escape in imagined musical numbers while saving for her son.','musical working class tragic experimental intense',1],
[1402,'The Pursuit of Happyness',2006,'Gabriele Muccino',117,'Drama','A struggling father pursues a competitive internship while facing homelessness with his young son.','hopeful working class family uplifting humane',4],
[10705,'Waitress',2007,'Adrienne Shelly',108,'Comedy','A small town waitress and gifted pie maker looks for a way out of an unhappy marriage.','warm working class food hopeful women comedy bittersweet',4],
[462,'Erin Brockovich',2000,'Steven Soderbergh',131,'Drama','A single mother uncovers a case of industrial water contamination and fights for affected families.','working class justice true story hopeful women humane',4],
[28178,'Hachi: A Dog’s Tale',2009,'Lasse Hallström',93,'Drama','A professor adopts a dog whose daily station visits become a story of enduring devotion.','dog grief family humane emotional',4],
[4960,'Synecdoche, New York',2008,'Charlie Kaufman',124,'Drama','A theater director builds an increasingly elaborate replica of his life inside a warehouse.','surreal existential architecture identity art melancholy',1],
[265177,'Mommy',2014,'Xavier Dolan',139,'Drama','A widowed mother struggles to raise her volatile teenage son with help from a neighbor.','family intense emotional music visual humane',4],
[11878,'Yojimbo',1961,'Akira Kurosawa',110,'Action','A wandering samurai turns two rival gangs against one another in a corrupt town.','black white action western satire violent',3],
[1931,'Stomp the Yard',2007,'Sylvain White',114,'Drama','A young dancer joins a university fraternity and enters a competitive stepping world.','dance community music coming age hopeful',4],
[244786,'Whiplash',2014,'Damien Chazelle',107,'Drama','An ambitious jazz drummer faces the punishing methods of a demanding conservatory instructor.','music obsession intense ambition psychological',3],
[1394,'Nostalghia',1983,'Andrei Tarkovsky',125,'Drama','A Russian poet travels through Italy and encounters a solitary man with a mysterious conviction.','slow contemplative spiritual memory alienation atmospheric',0],
[207,'Dead Poets Society',1989,'Peter Weir',128,'Drama','An English teacher encourages students at a strict boarding school to find their own voices.','school poetry hopeful coming age humane bittersweet',4],
[117,'The Untouchables',1987,'Brian De Palma',119,'Crime','A federal agent assembles a team to take down Al Capone in Prohibition era Chicago.','crime chicago urban period action',3]
];
export const groups=[{name:'The unknowable',color:'#8e7cab',desc:'Cosmic questions, solitude, slow revelations.'},{name:'Dream logic',color:'#d19179',desc:'Unstable identities and worlds that bend.'},{name:'Under siege',color:'#6b9694',desc:'Closed spaces. Outside threats. Mounting dread.'},{name:'Pressure points',color:'#aa9163',desc:'Obsession, moral compromise and human systems.'},{name:'Human connections',color:'#79966a',desc:'Work, family, community and everyday resilience.'},{name:'Ways of seeing',color:'#7896b0',desc:'Architecture, observation and visual experiments.'}];
export const catalog=rows.map(([id,title,year,director,runtime,genre,overview,tags,group,poster])=>({id,title,year,director,runtime,genre,overview,tags,group,poster:poster?'/'+poster:null,source:'starter'}));
// Correct IDs independently of display order.
catalog.find(m=>m.title==='Inland Empire').id=1730;

// Verified TMDb title/year matches for the editorial examples.
catalog.find(m=>m.title==='Jesus Camp').id=1776;
catalog.find(m=>m.title==='Waitress').id=10758;
catalog.find(m=>m.title==='Dancer in the Dark').id=16;
catalog.find(m=>m.title==='Nostalghia').aliases=['Nostalgia'];
