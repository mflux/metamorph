/*
	@author: Michael Chang
		Let me know what you think!
		flux.blackcat@gmail.com
*/		

var camera, scene, renderer;

var mouseX = 0, mouseY = 0, pmouseX = 0, pmouseY = 0;
var dragging = false;							

var width = window.innerWidth;
var height = window.innerHeight;	

//	an object3d containing everything in the editor
var stage;

//	an object3d containing the mesh the user is editing
var drawnMesh;

//	contains drawnMesh
var drawnCreature;

//	contains each body part cloned from drawnMesh
var segments = [];		    
					    		
var currentStroke;
var mirroredStroke;
var mirroredPen;

//	where the initial press for drawing is
var pressY = 0;

//	framecount, used for cycling animation
var frame = 0;

//	how far off screen does a creature need to be before we wrap it around
var buffer = 1.0;

var ocean;

//	magnify!
var giantDisplay = false;

//	run!!
init();		
animate();						

function init() {

    //	-----------------------------------------------------------------------------
    //	All the initialization stuff for THREE
	//	where in html to hold all our things
	container = document.createElement( 'div' );
	document.body.appendChild( container );		    	
	
	//	scene
    scene = new THREE.Scene();



    //	-----------------------------------------------------------------------------
    //	Setup our renderer
	renderer = new THREE.WebGLRenderer({antialias:false});
	renderer.setSize( window.innerWidth, window.innerHeight );
	container.appendChild( renderer.domElement );



    //	-----------------------------------------------------------------------------
    //	Setup our camera
    camera = new THREE.OrthographicCamera( 0, window.innerWidth, 0, window.innerHeight);		        		        		        
    // camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 3000 );
	camera.position.z = 1;
	camera.position.x = -width/2;
		scene.add( camera );


	//	THREEx window resize
	THREEx.WindowResize(renderer, camera);

    //	-----------------------------------------------------------------------------
    //	Event listeners
	container.addEventListener( 'mousemove', onDocumentMouseMove, false );
	container.addEventListener( 'mousedown', onDocumentMouseDown, false );	
	container.addEventListener( 'mouseup', onDocumentMouseUp, false );	
			
	
	//	setup the creature you're drawing
	drawnCreature = new THREE.Object3D();					
	drawnMesh = new THREE.Object3D();
	drawnCreature.add(drawnMesh);
	scene.add(drawnCreature);

	//	the gui for the drawing space
	stage = new THREE.Object3D();
	var centerLineGeo = new THREE.Geometry();
	centerLineGeo.vertices.push( new THREE.Vertex( new THREE.Vector3(0,0,0) ) )
	centerLineGeo.vertices.push( new THREE.Vertex( new THREE.Vector3(0,height,0) ) )
	var centerLineMat = new THREE.LineBasicMaterial(
		{
			linewidth: 	6,
			color: 		0x999999,
			opacity: 	0.8,
			depthTest: 	false,
			linecap: 	"round",
			linejoin: 	"round",
		}
	);
	var centerLine = new THREE.Line( centerLineGeo, centerLineMat );
	stage.add(centerLine);	
	var mirroredPenGeo = new THREE.CubeGeometry(6,6,1);
	mirroredPen = new THREE.Mesh( mirroredPenGeo, centerLineMat );
	stage.add( mirroredPen );
	scene.add(stage);

	//	the space where all swimming creatures live
	ocean = new THREE.Object3D();
	scene.add(ocean);
}


function animate() {        
	mirroredPen.position.x = width/2-mouseX;
	mirroredPen.position.y = mouseY;

	if(segments != undefined){
    	for( var i=0; i<segments.length; i++ ){
			var prevSegment = segments[i-1];
			var segment = segments[i];			    		
    		animateSegment( prevSegment, segment, i, controls.frequency, controls.amplitude );
    	}
    }

    for( var i=0; i<ocean.children.length; i++){
    	var creature = ocean.children[i];
    	// animateCreature( creature );
    	snakeAnimateCreature( creature );
    	creature.lifeSpan--;
    	if(creature.lifeSpan<0){
    		ocean.remove(creature);
    		renderer.deallocateObject(creature);			    		
    		i--;
    	}
    }
			 		    			          
    requestAnimationFrame( animate );				  					  					    
    render();	
	frame++;		        	     		        		        
}


function render() {					 		    	   	
    renderer.render( scene, camera );
}


function onDocumentMouseMove( event ) {

	pmouseX = mouseX;
	pmouseY = mouseY;

	mouseX = event.clientX;
	mouseY = event.clientY;

	if(dragging){
		onDragging();					
	}
}


function onDragging(){		
	if( pressY == 0 ){
		pressY = mouseY;			
		drawnCreature.position.y = pressY;
	}
	if( currentStroke != undefined ){
		currentStroke.paint( mouseX - width/2, mouseY - pressY );
		mirroredStroke.paint( width/2 - mouseX, mouseY - pressY );
	}
}


function onDocumentMouseDown( event ) {	
    dragging = true;	
    currentStroke = new PenStroke();	
    mirroredStroke = new PenStroke();				
}	

function onDocumentMouseUp( event ){
	dragging = false;
	if( currentStroke != undefined ){ 
		currentStroke.finishPainting();	
		mirroredStroke.finishPainting();

		//	attempt to merge the mirrored sides...
		//	doesn't work for now, don't know why
		// THREE.GeometryUtils.merge( mirroredStroke.mesh.geometry, currentStroke.mesh.geometry );
		// drawnMesh.remove( mirroredStroke.mesh );
		// renderer.deallocateObject( mirroredStroke.mesh );

		rebuildSegmentsForPreview();


		var output = stringifyCreature( drawnMesh );
		//	how to actually get the json string out of this?
		outputBox.setValue( output );					
	}								
}	


function generateCreature( headMesh, iterations ){
	// var creature = new Creature();
	var creature = new THREE.Object3D();
	creature.timing = Math.random() * Math.PI;
	creature.frequency = controls.frequency;
	creature.amplitude = controls.amplitude;
	creature.steering = Math.random() * Math.PI * 0.001;
		creature.speed = 3.4;
		creature.forward = new THREE.Vector2(0,-1);
		creature.steer = new THREE.Vector2(0,0);
		creature.velocity = new THREE.Vector2(0,0);
		creature.spacing = controls.spacing;
		creature.lifeSpan = 10000;		    	
	// console.log(creature);
	while( iterations >= 0 ){
		var copiedSegment = copySegment( headMesh, creature.children.length );
		creature.add( copiedSegment );		    				    		
		iterations--;
	}
	return creature;
}


function buildMirror( penStroke ){
	var clonedMesh = THREE.SceneUtils.cloneObject( penStroke.mesh );
	clonedMesh.translateX(width);
	clonedMesh.scale.x = -1;
	mirrored.add( clonedMesh );
}


function copySegment( segmentMesh, iteration ){
	var clonedMesh = THREE.SceneUtils.cloneObject( segmentMesh );
	composeSegmentProportion(clonedMesh, iteration);
	return clonedMesh;
}


function composeSegmentProportion( segmentMesh, iteration ){

	//	space the segments down, but closer and closer together
	segmentMesh.position.y += Math.log( 1 + iteration / (1 + (40-controls.spacing))) * 650;

	//	scale the segments smaller and smaller as it goes down the body
	segmentMesh.scale.x = 1 - 0.01 * iteration * iteration * controls.shrinkage;
	segmentMesh.scale.y = 1 - 0.005 * iteration * iteration * controls.shrinkage;

	//	set a minimum segment size
	if(segmentMesh.scale.x < 0.02)
		segmentMesh.scale.x = 0.02;
	if(segmentMesh.scale.y < 0.02)
		segmentMesh.scale.y = 0.02;			    	
}


function stringifyCreature( drawnMesh ){
	//	skip every other since we have both mirrored strokes in here
	//	eventually we'll want to merge the verts or something....
	var strokes = [];
	for( var s=0; s<drawnMesh.children.length; s+=2 ){
		var points = [];
		var vertices = drawnMesh.children[s].geometry.vertices;
		for(var i=0; i<vertices.length; i++){
			var position = vertices[i].position;
			var point = new Object();
			point.x = position.x;
			point.y = position.y;
			points.push( point );							
		}
		strokes.push(points);
	}	
	return JSON.stringify(strokes);
}


function loadCreature( jsonInput ){
	clearSegments();
	var loaded = JSON.parse(jsonInput);
	// drawnCreature.remove( drawnMesh );
	// renderer.deallocateObject( drawnMesh );
	// var drawnMesh = new THREE.Object3D();
	for( var i=0; i<loaded.length; i++){
		var verts = loaded[i];
		var geometry = new THREE.Geometry();
		var mirroredGeometry = new THREE.Geometry();
		for( var s=0; s<verts.length; s++){
			var vec = new THREE.Vector3( verts[s].x, verts[s].y, 0 );
			var vert = new THREE.Vertex(vec);
			geometry.vertices.push( vert );
			
			var mvec = new THREE.Vector3( -verts[s].x, verts[s].y, 0 );
			var mvert = new THREE.Vertex(mvec);
			mirroredGeometry.vertices.push(mvert)
		}
		var mesh = new THREE.Line( geometry, penMat, THREE.LineStrip );
		var mirroredMesh = new THREE.Line( mirroredGeometry, penMat, THREE.LineStrip );
		drawnMesh.add( mesh );
		drawnMesh.add( mirroredMesh );
	}
	drawnCreature.add( drawnMesh );
	segments = [];
	while( segments.length < controls.segments){
		var copiedSegment = copySegment( drawnMesh, segments.length + 1 );				
		drawnCreature.add( copiedSegment );
		segments.push( copiedSegment );
	}				
	// rebuildSegmentsForPreview();
	// console.log(loaded);
}


function rebuildSegmentsForPreview(){
	while( segments.length > 0 ){
		drawnMesh.remove( segments[0] );
		drawnCreature.remove(segments[0]);
		var removed = segments.splice( 0, 1);
		renderer.deallocateObject(removed);
	}
	
	while( segments.length < controls.segments){
		var copiedSegment = copySegment( drawnMesh, segments.length + 1 );				
		drawnCreature.add( copiedSegment );
		segments.push( copiedSegment );
	}
}


function clearSegments(){
	pressY = 0;
	while( segments.length > 0 ){
		drawnMesh.remove( segments[0] );
		drawnCreature.remove(segments[0]);
		var removed = segments.splice( 0, 1);
		renderer.deallocateObject(removed);
	}				
	drawnCreature.remove(drawnMesh);				
	drawnMesh = new THREE.Object3D();
	drawnCreature.add( drawnMesh );
	segments = [];			
}


function animateCreature( creatureObject ){
	var timing = creatureObject.timing;

	creatureObject.rotation.z += creatureObject.steering;

	var motionVector = new THREE.Vector3();
	motionVector.x = Math.cos( creatureObject.rotation.z - turn);
	motionVector.y = Math.sin( creatureObject.rotation.z - turn);

	motionVector.multiplyScalar( 0.8 + Math.sin(frame / 14 + Math.PI + timing) * 0.3 );

	if(creatureObject.position.x > width * buffer)
		creatureObject.position.x = - width * buffer;
	else
	if(creatureObject.position.x < - width * buffer)
		creatureObject.position.x = width * buffer;
	

	if(creatureObject.position.y > height * buffer * 2)
		creatureObject.position.y = - height * buffer;					
	else
	if(creatureObject.position.y < - height * buffer)
		creatureObject.position.y = height * buffer * 2;

	creatureObject.position.x += motionVector.x;
	creatureObject.position.y += motionVector.y;

	var frequency = creatureObject.frequency;
	var amplitude = creatureObject.amplitude;
	for( var i=1; i<creatureObject.children.length; i++ ){
		var prevSegment = creatureObject.children[i-1];
		var segment = creatureObject.children[i];
		animateSegment( prevSegment, segment, i, frequency, amplitude );
	}
}

var turn = Math.PI / 2;

function animateSegment( prevSegment, segment, iteration, frequency, amplitude ){
	var y = segment.position.y;
	segment.position.x = Math.sin( frame / frequency + ((iteration+1) * 0.02 + y * 0.02 ) ) * (iteration+1) * amplitude;
	if(iteration <= 0)
		return;
	var x1 = segment.position.x;
	var y1 = segment.position.y;
	var x2 = prevSegment.position.x;
	var y2 = prevSegment.position.y;
	var rotation = Math.atan2( y2 - y1, x2 - x1 ) + turn;
	segment.rotation.z = rotation;			
}

function snakeAnimateCreature( creatureObject ){
	var segments = creatureObject.children;
	var head = segments[0];
	creatureObject.speed = 3.4;		    	
	var turning = 0.05;	
	if( Math.random() > 0.986 )
		turning = 1.7;
	if( Math.random() > 0.5 ){
		creatureObject.steer.x -= (head.position.x) - width/2;
		creatureObject.steer.y -= (head.position.y);			    	
		creatureObject.steer.normalize();
		creatureObject.steer.multiplyScalar( turning );
	}
	else{
    	creatureObject.steer.x += (-1 + Math.random() * 2) * turning;
    	creatureObject.steer.y += (-1 + Math.random() * 2) * turning;			    	
    }
	Math.pow(creatureObject.steer.x, 2);
	Math.pow(creatureObject.steer.y, 2);
	creatureObject.steer.multiplyScalar(0.4);
	// creatureObject.steer.normalize();

	creatureObject.forward.addSelf( creatureObject.steer );		    			    	
	creatureObject.forward.normalize();		    			    	

	var finalSpeed = creatureObject.speed + Math.pow( 1+creatureObject.steer.length() * 2,2);
	creatureObject.velocity.x += creatureObject.forward.x * finalSpeed;
	creatureObject.velocity.y += creatureObject.forward.y * finalSpeed;
	creatureObject.velocity.multiplyScalar(0.64);

	head.position.x += creatureObject.velocity.x;
	head.position.y += creatureObject.velocity.y;

	head.rotation.z = Math.atan2( -creatureObject.forward.y, -creatureObject.forward.x ) - turn;		    	

	var prev = head;
	for( var i=1; i<segments.length; i++ ){		    		

		var segment = segments[i];
		if(i>1){
			prev = segments[i-1];
		}

		var spacing = Math.log( 1 + i / ( (40-creatureObject.spacing))) * 100;
		// var scaleY = 1 - 0.005 * i * i * controls.shrinkage;
		// spacing *= scaleY;

		var lenX = segment.position.x - prev.position.x;
		var lenY = segment.position.y - prev.position.y;
		var dist = Math.sqrt( lenX * lenX + lenY * lenY );
		if(dist > spacing){
			var direction = new THREE.Vector2(lenX,lenY);
			direction.normalize();
			direction.multiplyScalar(spacing);
			segment.position.x = prev.position.x + direction.x;
			segment.position.y = prev.position.y + direction.y;
		}
		segment.rotation.z = Math.atan2(-lenY, -lenX) + turn;		    		
		

		var prevVecX = Math.cos( prev.rotation.z - turn );
		var prevVecY = Math.sin( prev.rotation.z - turn);
		var prevVec = new THREE.Vector3(-prevVecX, -prevVecY);
		var thisVec = new THREE.Vector3(lenX, lenY);
		thisVec.normalize();
		var dotProduct = prevVec.dot( thisVec );
		if( Math.abs(dotProduct) > 0.5){
			prevVec.multiplyScalar(spacing);		    			
			var targetPos = new THREE.Vector3( prev.position.x, prev.position.y );
			targetPos = targetPos.addSelf(prevVec);		    			
			segment.position.x = segment.position.x + (targetPos.x - segment.position.x) * .4;
			segment.position.y = segment.position.y + (targetPos.y - segment.position.y) * .4;
		}
	}

}





//	a penstroke object contains points about each pen stroke and the ability to add to each stroke
function PenStroke(){
	this.maxPenPoints = 400;
	this.geometry = new THREE.Geometry();
	this.geometry.dynamic = true;
	for( var i=0; i<this.maxPenPoints; i++){
		this.geometry.vertices.push( new THREE.Vertex( new THREE.Vector3(0,0,0) ) );	
		// this.geometry.colors.push( new THREE.Color(0x000000) );
	}			
	this.mesh = new THREE.Line( this.geometry, penMat, THREE.LineStrip);
	this.mesh.renderDepth = false;
	drawnMesh.add(this.mesh);			

	this.paintIndex = 0;

	//	set higher to reduce number of points painted
	this.minimumStrokeLength = 2;
	
	this.paint = function( drawX, drawY ){

		if( this.minimumStrokeLength > 0 ){
			var lastX = this.mesh.geometry.vertices[this.paintIndex].position.x;
			var lastY = this.mesh.geometry.vertices[this.paintIndex].position.y;					
			var lenX = drawX - lastX;
			var lenY = drawY - lastY;
			var dist = Math.sqrt( lenX * lenX + lenY * lenY );
			if(dist < this.minimumStrokeLength)
				return;						
		}					

		for( var i=this.paintIndex; i<this.mesh.geometry.vertices.length; i++ ){
			this.mesh.geometry.vertices[i].position.x = drawX;
			this.mesh.geometry.vertices[i].position.y = drawY;
		}
		
		this.mesh.geometry.__dirtyVertices = true;

		this.paintIndex++;				         							
		if( this.paintIndex >= this.mesh.geometry.vertices.length )
			this.paintIndex = 0;						
	}    	

	this.finishPainting = function(){
		//	do some cleanup and culling of verts					
	
		//	cut down the number of verts to exactly what's drawn
		this.geometry.vertices = this.geometry.vertices.splice( 0,this.paintIndex );				

		//	deallocate the mesh object
		drawnMesh.remove( this.mesh );

		//	this kills the mesh...
		// renderer.deallocateObject( this.mesh );

		//	make a new one and insert it to drawnMesh
		this.mesh = new THREE.Line( this.geometry, penMat, THREE.LineStrip );

		//	what does this do?
		this.geometry.__webglLineCount = this.paintIndex;

		//	the new vert count...
		// console.log( this.mesh.geometry.vertices.length );

		drawnMesh.add( this.mesh );
	}
}




var penMat = new THREE.LineBasicMaterial(
	{
		linewidth: 1,
		color: 			0xFFFFFF,
		linecap: 		"round",
		linejoin: 		"round",
		depthTest: 		false,
		// blending: 		THREE.AdditiveBlending,
		// transparent: 	true,
	}
);



//	Some global constants that control everything
var controllers = function() {
	this.clear = function() {
		clearSegments();	
	};
	this.segments = 19;		
	this.spacing = 19;	
	this.shrinkage = 0.5;
	this.amplitude = 1.2;
	this.frequency = 20;
	this.lineWeight = 1;	
	this.create = function(){
		var size = 0.5 + Math.random() * 0.5;

		var segments = this.segments - 10 + 16 * size;
		segments = Math.floor(segments);
		if( segments < 3 )
			segments = 3;

		var creature = generateCreature( drawnMesh, segments );
		ocean.add(creature);

		creature.position.x = Math.random() * width * 0.4 - width * 0.2;
		creature.position.y = Math.random() * height * 0.3 - height * 0.15 + height/2;
		creature.rotation.z = Math.random() * 360 * Math.PI / 180 + Math.PI/2;					

		creature.scale.x = creature.scale.y = 0.2 + size * 0.5;
	};
	
	this.output = "";
	
	this.onBlack = true;
	this.invert = function() {
		this.onBlack = !this.onBlack;
		if( this.onBlack ){
			renderer.setClearColorHex( 0x000000 );
			penMat.color = new THREE.Color( 0xFFFFFF );						
		}
		else{					
			renderer.setClearColorHex( 0xFFFFFF );
			penMat.color = new THREE.Color( 0x000000 );
		}					
	};

	this.exterminate = function(){
		for( var i=0; i<ocean.children.length; i++ ){
			renderer.deallocateObject( ocean.children[i] );
			ocean.remove( ocean.children[i] );
			i--;
		}
		// renderer.deallocateObject( ocean );
		// ocean = new Object3D();
		// scene.add(ocean);
	};

	this.load = function(){
		loadCreature(outputBox.getValue());
	};
}

var controls;
var outputBox;
window.onload = function(){
	controls = new controllers();
	var gui = new dat.GUI({ autoPlace: false });					
	gui.add( controls, "create" );	
	var controller = gui.add( controls, "segments", 4, 30);
	controller.onChange( function(value){ rebuildSegmentsForPreview(); });
	controller = gui.add( controls, "spacing", 0, 36);
	controller.onChange( function(value){ rebuildSegmentsForPreview(); });				
	controller = gui.add( controls, "shrinkage", 0.1, 1 );
	controller.onChange( function(value){ rebuildSegmentsForPreview(); });
	// gui.add( controls, "amplitude", 0.1, 4 );		
	// gui.add( controls, "frequency", 8, 60 );		
	// controller = gui.add( controls, "lineWeight", 1, 6);			
	// controller.onChange( function(value){ penMat.linewidth = value; } );				

	
	controller = outputBox = gui.add( controls, "output" );
	controller.onFinishChange( function(value){ loadCreature(value); });

	// controller = gui.add( controls, "load" );

	// gui.add( controls, "invert" );

	gui.add( controls, "clear" );
	
	var customContainer = document.getElementById('guiContainer');
	customContainer.appendChild( gui.domElement);

	gui.add( controls, "exterminate" );

	// console.log(gui.domElement.getElementById("dg main"));
}		

function gup( name )
{
	name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
	var regexS = "[\\?&]"+name+"=([^&#]*)";
	var regex = new RegExp( regexS );
	var results = regex.exec( window.location.href );
	if( results == null )
	return "";
	else
	return results[1];
}

/*
	
	Some things I want to add...
		colors and color cycling
		saving and loading with strings
		upload to database
		different symmetries (circular, fractal, etc)
		skin entire mesh to skeleton
		use morph targets some how (squash and stretch)
		better serpent motion animation
*/

