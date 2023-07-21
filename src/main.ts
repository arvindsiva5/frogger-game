import { interval, fromEvent, merge, Observable, from, timer } from "rxjs";
import { MapOperator } from "rxjs/internal/operators/map";
import { map, filter, scan, concatMap, tap, delayWhen } from "rxjs/operators";

function main(this: any) {
  /**
   * Inside this function the classes and functions from rx.js is used
   * to add visuals to the svg element in pong.html, animate them, and make them interactive.
   */

  /**
   * This is the view for your game to add and update your game elements.
   */

  // type declarations for movement direction of frog and moving objects
  type frogMoveDirection = "left" | "right" | "up" | "down";
  type movingObjDirection = "left" | "right";
  /* */
  /*
    object for storing data for moving objects
    default data attributes and this object will be extended for
    different moving object types
  */
  interface movingObjDefault {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    direction: movingObjDirection;
    moveSize: number;
  }

  // car, plank & croc objects
  interface car extends movingObjDefault {}
  interface plank extends movingObjDefault {}
  interface croc extends movingObjDefault {}

  // turtle object
  interface turtle extends movingObjDefault {
    hidden: boolean;
    diveRange: [number, number];
  }

  // union data type representing all moving objects
  type movingObj = car | plank | croc | turtle;
  // union data type representing all moving objects in the river
  type riverMovingObj = plank | croc | turtle;
  // union type declaration of moving objects that are not turtle
  type notTurtle = car | plank | croc;

  // object for storing data for distinct target areas
  interface distTargetArea {
    x: number;
    y: number;
    width: number;
    height: number;

    occupied: boolean; // occupied == True if a Frog has landed here or else false
  }

  // object for storing data on the current state of the game
  interface gameState {
    frog: Frog;
    cars: car[];
    planks: plank[];
    crocs: croc[];
    turtles: turtle[];
    distTargetAreas: distTargetArea[];
    score: number;
    highScore: number;
    restart: boolean; // used to indicate if a round is over or not
    init: boolean; // used to indicate wether this object is a starting state
  }

  // global constant for svg width & height
  const SVG_WIDTH_HEIGHT: number = 600;

  // class is used to store the direction of Frog movement
  // able to use instanceof to detect wether the Frog moved or not
  class FrogMove {
    constructor(public readonly d: frogMoveDirection) {}

    // check if the user move on frog is up movement
    public isUp = () => this.d === "up";

    // check if the given value is a FrogMove instance
    public static isFrogMove: (m: FrogMove | string) => boolean = (m) =>
      m instanceof FrogMove;
  }

  /* 
    class for Frog
    stores data and methods to manipulate the frog based on user movement and 
    moving objects frog has a lot methods required to process it in the game
  */
  class Frog {
    // radius of frog used to calculate x and y when it moves
    public static readonly rad = 20;

    // moveSizeX is how much the Frog can move horizontally
    // moveSizeY is how much the Frog can move vertically
    public static readonly moveSizeX = 5;
    public static readonly moveSizeY = 50;

    constructor(
      public readonly id: number,
      public readonly x: number,
      public readonly y: number,
      // mObjId stores the id of river moving object the frog is in
      public readonly mObjId: string = "",
      // done is used to disable user move if frog reach distinct target area
      public readonly done: boolean = false
    ) {}

    // creates first Frog for starting a new round with fixed x and y
    public static starterFrog = () => new Frog(1, 250, 580);

    // creates a copy of the Frog
    public noMove = () => new Frog(this.id, this.x, this.y, this.mObjId);

    // creates a copy of current Frog with default starting position
    public defaultPosition = () => new Frog(this.id, 250, 580);

    // creates a copy of Frog with updated x and y based on user move
    // calls functions based on the direction of user move
    public move = (m: FrogMove) =>
      m.d == "left"
        ? this.moveLeft()
        : m.d == "right"
        ? this.moveRight()
        : m.d == "up"
        ? this.moveUp()
        : this.moveDown();

    /* 
      creates a copy of Frog with updated x if user makes valid left move
      makes sure Frog only can move left if the left move wouldn't make it go 
      out of the svg
    */
    private moveLeft = () =>
      this.x - Frog.moveSizeX >= Frog.rad
        ? new Frog(this.id, this.x - Frog.moveSizeX, this.y, this.mObjId)
        : this.noMove();

    /* 
      creates a copy of Frog with updated x if user makes valid right move
      makes sure Frog only can move right if the right move wont make it go 
      out of the svg 
    */
    private moveRight = () =>
      this.x + Frog.moveSizeX <= SVG_WIDTH_HEIGHT - Frog.rad
        ? new Frog(this.id, this.x + Frog.moveSizeX, this.y, this.mObjId)
        : this.noMove();

    /* 
      creates a copy of Frog with updated y if user makes valid up move
      makes sure Frog only can move up if the up move wont make it go 
      out of the svg
    */
    private moveUp = () =>
      this.y - Frog.moveSizeY >= Frog.rad
        ? new Frog(this.id, this.x, this.y - Frog.moveSizeY, this.mObjId)
        : this.noMove();

    /*
      creates a copy of Frog with updated y if user makes valid down move
      makes sure Frog only can move down if the down move wont make it go 
      out of the svg
    */
    private moveDown = () =>
      this.y + Frog.moveSizeY <= SVG_WIDTH_HEIGHT - Frog.rad
        ? new Frog(this.id, this.x, this.y + Frog.moveSizeY, this.mObjId)
        : this.noMove();

    // create copy of Frog with done == True so that the Frog stays at
    // distinct target area and not able to move by user
    private reachDistinctTargetArea = () =>
      new Frog(this.id, this.x, this.y, "", true);

    // creates new Frog with new id
    // called when the current frog landed in distinct target area
    public incrementID = () => new Frog(this.id + 1, 250, 580);

    // checks if Frog has collided with a car
    // checks the x and y values of both car and Frog to rule out a collision
    private isCollide = (car: car) =>
      this.x - Frog.rad < car.x + car.width &&
      this.x + Frog.rad > car.x &&
      this.y - Frog.rad < car.y + car.height &&
      this.y + Frog.rad > car.y;

    // checks if Frog has collided with any cars in the game
    public isCollideCars = (cars: car[]) =>
      cars.reduce((acc, x) => acc || this.isCollide(x), false);

    // creates a copy of Frog in default position if collision occur and
    // return copy of Frog if no collision with car
    public moveCarCollide = (cars: car[]) =>
      cars.reduce((acc, x) => acc || this.isCollide(x), false)
        ? this.defaultPosition()
        : this.noMove();

    /* 
      create a copy of Frog where mObjId == the id of the riverMovingObject 
      Frog is on
    */
    private attachMObjId =
      (turtles: turtle[]) => (planks: plank[]) => (crocs: croc[]) =>
        new Frog(
          this.id,
          this.x,
          this.y,
          turtles.reduce((acc, x) => (this.isIn(x) ? x.id : acc), "") +
            planks.reduce((acc, x) => (this.isIn(x) ? x.id : acc), "") +
            crocs.reduce((acc, x) => (this.isIn(x) ? x.id : acc), "")
        );

    // create a copy of Frog where mObjId = ""
    // used when Frog not on riverMovingObject
    private dettachMObjId = () => new Frog(this.id, this.x, this.y);

    /* 
      checks if Frog is in a river moving obj or distinct target area
      checks the x and y values of both d and Frog to rule out if Frog is 
      in distTargetArea or riverMovingObj
    */
    public isIn = (d: distTargetArea | riverMovingObj) =>
      this.x - Frog.rad >= d.x &&
      this.x + Frog.rad <= d.x + d.width &&
      this.y - Frog.rad >= d.y &&
      this.y + Frog.rad <= d.y + d.height;

    // checks if Frog is in any of the planks in the game
    private isInPlank = (p: plank[]) =>
      p.reduce((acc, x) => this.isIn(x) || acc, false);

    // checks if Frog is in any of the turtles in the game
    private isInturtle = (t: turtle[]) =>
      t.reduce((acc, x) => (this.isIn(x) && !x.hidden) || acc, false);

    // checks if Frog is in the crocodile mouth in the game
    private isInCrocMouth = (croc: croc) =>
      this.x - Frog.rad < croc.x + 15 &&
      this.x + Frog.rad > croc.x &&
      this.y - Frog.rad < croc.y + croc.height &&
      this.y + Frog.rad > croc.y;

    // checks if Frog is in any crocodiles back and not in crocodile mouths in game
    private isInCroc = (crocs: croc[]) =>
      crocs.reduce(
        (acc, x) => (this.isIn(x) && !this.isInCrocMouth(x)) || acc,
        false
      );

    // checks if the Frog is in any of the moving object in river
    public isInRiverMovingObj =
      (turtles: turtle[]) => (planks: plank[]) => (crocs: croc[]) =>
        this.isInturtle(turtles) ||
        this.isInPlank(planks) ||
        this.isInCroc(crocs);

    // checks if Frog is in any distingTargetArea
    public isInDistinctTargetArea = (d: distTargetArea[]) =>
      d.reduce((acc, x) => acc || (this.isIn(x) && !x.occupied), false);

    // create copy of Frog with updated x based on river moving object that frog is in
    private moveWithMovingObj = (o: riverMovingObj) =>
      new Frog(
        this.id,
        this.x + (o.direction == "right" ? o.moveSize : -1 * o.moveSize),
        this.y,
        this.mObjId
      );

    /* 
      create a copy of Frog when user makes move with Frog in river
      - mObjId attached if Frog is in a moving object
      - done == True if the Frog is in distinct target area and
      - the frog can no more be moved by the user
      - mObjId is dettached if Frog is in safezone
      - Frog is returned to default position if it is in river
    */
    public moveAtRiver =
      (turtles: turtle[]) =>
      (planks: plank[]) =>
      (crocs: croc[]) =>
      (d: distTargetArea[]) =>
        this.isInRiverMovingObj(turtles)(planks)(crocs)
          ? this.attachMObjId(turtles)(planks)(crocs)
          : this.isInDistinctTargetArea(d)
          ? this.reachDistinctTargetArea()
          : this.y >= 330
          ? this.dettachMObjId()
          : this.defaultPosition();

    /* 
      create a copy of Frog when Frog in river and NO user move
      - copy of Frog is returned if it is in safezone
      - if Frog hits the edge of svg while on moving object it is
      returned to default position
      - if Frog is still in moving object, its x is updated to match
      moving object movement
    */
    public noMoveAtRiver = (id: string) => (o: movingObj) =>
      o == undefined
        ? this.noMove()
        : this.mObjId == id &&
          (o.direction == "right"
            ? o.x >= SVG_WIDTH_HEIGHT - o.width - 1
            : o.x < 1)
        ? this.defaultPosition()
        : this.mObjId == id
        ? this.moveWithMovingObj(o)
        : this.noMove();
  }

  // creates a distTargetArea object at sepcified x
  const createDistTargetArea = (x: number) => {
      return <distTargetArea>{
        x: x,
        y: 50,
        width: 104,
        height: 50,
        occupied: false,
      };
    },
    // creates a car object
    // id, xy coordinates must be specified
    // d is the direction car moves in
    createCar =
      (id: string) => (x: number) => (y: number) => (d: movingObjDirection) => {
        return <car>{
          id: id,
          x: x,
          y: y,
          width: 50,
          height: 40,
          direction: d,
          moveSize: 0.5,
        };
      },
    // creates a plank object
    // id, xy coordinates must be specified
    // d is the direction plank moves in
    createPlank =
      (id: string) => (x: number) => (y: number) => (d: movingObjDirection) => {
        return <plank>{
          id: id,
          x: x,
          y: y,
          width: 70,
          height: 40,
          direction: d,
          moveSize: 0.5,
        };
      },
    // creates a crocodile object
    // id, xy coordinates must be specified
    // d is the direction crocodile moves in
    createCroc =
      (id: string) => (x: number) => (y: number) => (d: movingObjDirection) => {
        return <croc>{
          id: id,
          x: x,
          y: y,
          width: 80,
          height: 40,
          direction: d,
          moveSize: 0.5,
        };
      },
    // creates a turtle object
    // id, xy coordinates must be specified
    // d is the direction crocodile moves in
    /* 
    * r is diveRange is list of two integers and used to determine at which x coordinate 
      range the turtle will dive and not be visible
    */
    createTurtle =
      (id: string) =>
      (x: number) =>
      (y: number) =>
      (d: movingObjDirection) =>
      (r: [number, number]) => {
        return <turtle>{
          id: id,
          x: x,
          y: y,
          width: 50,
          height: 40,
          direction: d,
          moveSize: 0.5,
          hidden: false,
          diveRange: r,
        };
      };

  // constant containing data of the game's state at the start of game
  const INITIAL_STATE: Readonly<gameState> = {
    frog: Frog.starterFrog(),
    cars: [
      createCar("car1a")(0)(510)("right"),
      createCar("car1b")(200)(510)("right"),
      createCar("car1c")(400)(510)("right"),
      createCar("car2a")(0)(460)("right"),
      createCar("car2b")(200)(460)("right"),
      createCar("car2c")(400)(460)("right"),
      createCar("car3a")(0)(410)("left"),
      createCar("car3b")(200)(410)("left"),
      createCar("car3c")(400)(410)("left"),
      createCar("car4a")(0)(360)("left"),
      createCar("car4b")(200)(360)("left"),
      createCar("car4c")(400)(360)("left"),
    ],
    planks: [
      createPlank("plank1a")(0)(210)("left"),
      createPlank("plank1b")(200)(210)("left"),
      createPlank("plank1c")(400)(210)("left"),
      createPlank("plank2a")(0)(160)("right"),
      createPlank("plank2b")(200)(160)("right"),
      createPlank("plank2c")(400)(160)("right"),
    ],
    crocs: [
      createCroc("croc1a")(0)(110)("left"),
      createCroc("croc1b")(200)(110)("left"),
      createCroc("croc1c")(400)(110)("left"),
    ],
    turtles: [
      createTurtle("turtle1a")(0)(260)("right")([100, 150]),
      createTurtle("turtle1b")(100)(260)("right")([50, 100]),
      createTurtle("turtle1c")(200)(260)("right")([400, 450]),
      createTurtle("turtle1d")(300)(260)("right")([450, 500]),
      createTurtle("turtle1e")(400)(260)("right")([200, 250]),
    ],
    distTargetAreas: [
      createDistTargetArea(20),
      createDistTargetArea(134),
      createDistTargetArea(248),
      createDistTargetArea(362),
      createDistTargetArea(476),
    ],
    score: 0,
    highScore: 0,
    restart: false,
    init: true,
  };

  // svg is used to manipulate the svgCanvas in HTML
  const svg = document.querySelector("#svgCanvas") as SVGElement & HTMLElement;

  // create a frog on HTML based on data supplied by f:Frog
  // these are a group of impure function that access HTML
  const createFrogView = (f: Frog) => {
      const circle: Element = document.createElementNS(
        svg.namespaceURI,
        "circle"
      );
      circle.setAttribute("r", String(Frog.rad));
      circle.setAttribute("cx", String(f.x));
      circle.setAttribute("cy", String(f.y));
      circle.setAttribute("style", "fill: green");
      circle.id = "frog" + String(f.id);
      return circle;
    },
    // updates the xy coordinates of frog on HTML based on data supplied by f:Frog
    // called when frog move or frog on moving object
    updateFrogView = (f: Frog) => {
      const frog = document.getElementById("frog" + String(f.id));
      frog?.setAttribute("cx", String(f.x));
      frog?.setAttribute("cy", String(f.y));
    },
    // removes all the frogs in the HTML
    removeFrogsView = () => {
      [1, 2, 3, 4, 5]
        .map((n) => String(n))
        .forEach((n) => document.getElementById("frog" + n)?.remove());
    };

  // type declaration of function that determines colour of moving object on HTML
  type movingObjFill = (e: Element) => Element;

  // creates a moving object on HTML based on data supplied by o:movingObj
  // these are a group of impure function that access HTML
  const createMovingObjView = (o: movingObj) => (f: movingObjFill) => {
      const mOV: Element = document.createElementNS(svg.namespaceURI, "rect");
      mOV.setAttribute("id", o.id);
      mOV.setAttribute("x", String(o.x));
      mOV.setAttribute("y", String(o.y));
      mOV.setAttribute("width", String(o.width));
      mOV.setAttribute("height", String(o.height));
      return f(mOV);
    },
    // used to make cars have the color white in HTML
    fillCar = (e: Element) => {
      e.setAttribute("style", "fill: white");
      return e;
    },
    // used to make planks have the color #bf7835 in HTML
    fillPlank = (e: Element) => {
      e.setAttribute("style", "fill: #bf7835");
      return e;
    },
    // used to make crocodiles have the color #a2cf8f in HTML
    fillCroc = (e: Element) => {
      e.setAttribute("style", "fill: #a2cf8f");
      return e;
    },
    // used to make crocodiles mouths have the color white  in HTML
    fillCrocMouth = (e: Element) => {
      e.setAttribute("style", "fill: white");
      return e;
    },
    // used to create the mouths of crocodiles in HTML
    crocMouth = (c: movingObj) => {
      return createMovingObjView({ ...c, id: c.id + "-m", width: 15 })(
        fillCrocMouth
      );
    },
    // used to make turtles have the color red in HTML
    fillTurtle = (e: Element) => {
      e.setAttribute("style", "fill: red");
      return e;
    },
    // updates xy coordinates of car, plank & crocodiles
    // called when car, plank & crocodiles need to move
    updateCarPlankCrocView = (o: notTurtle) => {
      const mOV = document.getElementById(o.id);
      mOV?.setAttribute("x", String(o.x));
      mOV?.setAttribute("y", String(o.y));
    },
    // updates xy coordinates of turtle
    // called when turtle need to move
    updateTurtleView = (o: turtle) => {
      const turtle = document.getElementById(o.id);
      if (!turtle) {
        throw "Turtle does not exist";
      }
      turtle.setAttribute("x", String(o.x));
      turtle.setAttribute("y", String(o.y));
      turtle.style.visibility = o.hidden ? "hidden" : "";
    },
    // updates xy coordinates of crocodile mouth
    // called when crocodile need to move
    updateCrocMouthView = (c: croc) => {
      const crocMouth = document.getElementById(c.id + "-m");
      if (!crocMouth) {
        throw "Error";
      }
      crocMouth.setAttribute("x", String(c.x));
      crocMouth.setAttribute("y", String(c.y));
    },
    // updates position of moving objects in HTML
    updateMovingObjsView = (s: gameState) => {
      s.cars.forEach(updateCarPlankCrocView);
      s.planks.forEach(updateCarPlankCrocView);
      s.crocs.forEach(updateCarPlankCrocView);
      s.crocs.forEach(updateCrocMouthView);
      s.turtles.forEach(updateTurtleView);
    };

  // update score and highscore in HTML
  // this is an impure function that access HTML
  const updateScoresView = (s: number) => (hS: number) => {
    const score = document.getElementById("score");
    if (!score) {
      throw "Error";
    }
    score.innerHTML = "Score: " + String(s) + " Highscore: " + String(hS);
  };

  // used in observables subscribe to update the HTML based on the state
  // these are a group of impure function that access HTM
  // function called in subscribe to update html based on state
  const updateView = (s: gameState) => {
      s.init
        ? initView(s)
        : s.restart
        ? updateViewRestart(s)
        : updateViewContinue(s);
    },
    // creates frog and moving objects in HTML at the start of game
    initView = (s: gameState) => {
      s.cars.forEach((x) => svg.append(createMovingObjView(x)(fillCar)));
      s.planks.forEach((x) => svg.append(createMovingObjView(x)(fillPlank)));
      s.crocs.forEach((x) => {
        svg.append(createMovingObjView(x)(fillCroc));
        svg.append(crocMouth(x));
      });
      s.turtles.forEach((x) => svg.append(createMovingObjView(x)(fillTurtle)));
      svg.append(createFrogView(s.frog));
    },
    /* 
      updates HTML when all 5 Frogs landed in distinct target area (makes a new round) 
      based on the state
      frogs are removed from distinct target areas and frog is created at starting 
      point
    */
    updateViewRestart = (s: gameState) => {
      removeFrogsView();
      svg.append(createFrogView(s.frog));
      updateMovingObjsView(s);
      updateScoresView(s.score)(s.highScore);
    },
    // updates HTML everytime the state changes except for restarting a round and the start of the game
    updateViewContinue = (s: gameState) => {
      updateMovingObjsView(s);
      updateScoresView(s.score)(s.highScore);
      document.getElementById("frog" + String(s.frog.id))
        ? updateFrogView(s.frog)
        : svg.append(createFrogView(s.frog));
    };
    

  // type declaration for updateXMovingObj function
  type updateXMovingObjFunc = (
    x: number
  ) => (w: number) => (d: movingObjDirection) => (n: number) => number;

  // moves car, plank & crocodile by updating x
  const moveNotTurtle = (o: notTurtle) => {
      return <notTurtle>{
        ...o,
        x: updateXMovingObj(o.x)(o.width)(o.direction)(o.moveSize),
      };
    },
    /*
      - moves turtle by updating x and hidden according to diveRange
      - hidden is set to true if x is within diveRange (make turtle dive) 
      else false
      - the turtle is only allowed to dive if no frog is on it
    */
    moveTurtle = (t: turtle) => (f: Frog) => {
      const x = updateXMovingObj(t.x)(t.width)(t.direction)(t.moveSize);
      return <turtle>{
        ...t,
        x: x,
        hidden:
          x >= t.diveRange[0] &&
          x <= t.diveRange[1] &&
          !isIdEqual(f.mObjId)(t.id),
      };
    },
    /* 
      - updates the x coordinate of moving object
      - x value is updated such that it wraps around the svg when it hits the edge of svg
      - moveSize is increased for right movement and decrease for left movement
      - the value of x is mod with SVG_WIDTH_HEIGHT - width to make sure the moving
      - object wrap around svg and not go out
    */
    updateXMovingObj: updateXMovingObjFunc =
      (x) => (width) => (direction) => (moveSize) =>
        direction == "right"
          ? (x + moveSize) % (SVG_WIDTH_HEIGHT - width)
          : (x - moveSize) % (SVG_WIDTH_HEIGHT - width) < 0
          ? SVG_WIDTH_HEIGHT - width
          : (x - moveSize) % (SVG_WIDTH_HEIGHT - width),
    /* 
      increases the moveSize of car, plank & crocofile by 0.2
      called when new round to increase speed
      increase difficulty in every round
    */
    increaseCarRaftPlankMoveSize = (o: notTurtle[]) => {
      return <notTurtle[]>o.map((x) => {
        return { ...x, moveSize: x.moveSize + 0.2 };
      });
    },
    /* 
      increases the moveSize of turtle by 0.2
      called when new round to increase speed
      increase difficulty in every round
    */
    incrementTurtleMoveSize = (t: turtle[]) => {
      return <turtle[]>t.map((x) => {
        return { ...x, moveSize: x.moveSize + 0.2 };
      });
    },
    // checks if 2 ids are equal
    isIdEqual = (id1: string) => (id2: string) => id1 === id2,
    // moves a car, plank or crocodile if the id is equal to the one in function arg
    moveNotTurtles = (id: string) => (o: notTurtle[]) => {
      return <notTurtle[]>(
        o.map((x) => (isIdEqual(x.id)(id) ? moveNotTurtle(x) : { ...x }))
      );
    },
    // moves a turtle if the id is equal to the one in function arg
    moveTurtles = (f: Frog) => (id: string) => (o: turtle[]) => {
      return <turtle[]>(
        o.map((x) => (isIdEqual(x.id)(id) ? moveTurtle(x)(f) : { ...x }))
      );
    };

  // type declaration for calculateScoreSea function
  type calculateScoreSeaFunc = (
    frog: Frog
  ) => (
    m: FrogMove
  ) => (
    d: distTargetArea[]
  ) => (
    turtles: turtle[]
  ) => (planks: movingObj[]) => (crocs: movingObj[]) => calculateScoreSeaRetVal;
  // type declaration for return value of calculateScoreSea function
  type calculateScoreSeaRetVal = (f: (n: number) => number) => number;
  // type declaration for riverMovingObjWithFrog function
  type riverMovingObjWithFrogFunc = (
    frog: Frog
  ) => (
    planks: plank[]
  ) => (crocs: croc[]) => (turtles: turtle[]) => riverMovingObj;

  // used in scan in observable to manipulate state
  // returns new state when user move or when moving object need to move
  const reduceState = (s: gameState, m: string | FrogMove) => {
      return m === "start" ? startState(s) : notStartState(s)(m);
    },
    // returns the state of the start of the game
    startState = (s: gameState) => {
      return <gameState>{ ...s };
    },
    // returns the state of the game after starting
    notStartState = (s: gameState) => (m: any) => {
      const nS: gameState = completeState(s);
      return FrogMove.isFrogMove(m)
        ? reduceStateFrogMove(nS)(m)
        : reduceStateNoFrogMove(nS)(m);
    },
    /* 
    - update state if a round is over or when a frog has occupied distinct target area
    - if round is over moveSize of moving objects increase & score is reset and 
    highscore maintained
    - if a frog landed in distinct target area, new frog created and the current frog stay
    in distinct target area
    */
    completeState = (s: gameState) => {
      return s.frog.done && s.frog.id == 5
        ? <gameState>{
            ...INITIAL_STATE,
            frog: Frog.starterFrog(),
            score: 0,
            highScore: s.highScore,
            restart: true,
            planks: increaseCarRaftPlankMoveSize(INITIAL_STATE.planks),
            cars: increaseCarRaftPlankMoveSize(INITIAL_STATE.cars),
            crocs: increaseCarRaftPlankMoveSize(INITIAL_STATE.crocs),
            turtles: incrementTurtleMoveSize(INITIAL_STATE.turtles),
            init: false,
          }
        : <gameState>{
            ...s,
            frog: s.frog.done ? s.frog.incrementID() : s.frog.noMove(),
            restart: false,
            init: false,
          };
    },
    // returns the state after user makes movement with frog
    reduceStateFrogMove = (s: gameState) => (m: FrogMove) => {
      return s.frog.y > 350
        ? roadFrogMoveState(s)(m)
        : riverFrogMoveState(s)(m);
    },
    // returns the state of the game when user makes no movement with frog
    reduceStateNoFrogMove = (s: gameState) => (id: string) => {
      return s.frog.y < 350
        ? riverNoFrogMoveState(s)(id)
        : roadNoFrogMoveState(s)(id);
    },
    // calculates score when user moves frog on the road
    calculateScoreRoad = (f: Frog) => (m: FrogMove) => (c: car[]) => {
      return (n: Function) => n(!f.isCollideCars(c) && m.isUp() ? 10 : 0);
    },
    // adds up score of the round with the score achieved for current user move
    updateScore = (n1: number) => (n2: number) => n1 + n2,
    // returns a new highscore if the score is higher than highscore at every user move
    updateHighScore = (hS: number) => (s: number) => s > hS ? s : hS,
    // returns the state when a frog move on road
    // frog go to default position (dies) if car collide else its allowed to move
    // score +10 if frog move up and no collision
    roadFrogMoveState = (s: gameState) => (m: FrogMove) => {
      const f = s.frog.move(m),
        currentScore = calculateScoreRoad(f)(m)(s.cars),
        score = currentScore(updateScore(s.score));
      return <gameState>{
        ...s,
        frog: f.moveCarCollide(s.cars),
        score: score,
        highScore: updateHighScore(score)(s.highScore),
      };
    },
    // calculates score when user moves frog in the river
    calculateScoreRiver: calculateScoreSeaFunc =
      (frog) => (m) => (d) => (turtles) => (planks) => (crocs) => {
        return m.isUp()
          ? frog.isInDistinctTargetArea(d)
            ? (f: Function) => f(100)
            : frog.isInRiverMovingObj(turtles)(planks)(crocs)
            ? (f: Function) => f(10)
            : (f: Function) => f(0)
          : (f: Function) => f(0);
      },
    // returns distTargetArea[] with occupied = true if the Frog is there
    updateDistTargetAreaOccupied = (f: Frog) => (d: distTargetArea[]) => {
      return d.map((x) =>
        f.isIn(x)
          ? <distTargetArea>{ ...x, occupied: true }
          : <distTargetArea>{ ...x }
      );
    },
    // returns state when user move frog on river and safezone
    // score +10 if frog move up and in safezon or moving obj
    // score +100 if frog in distinct target area
    // frog allowed to move if not in river else go to default position (dies)
    // distinct target area occupied status updated
    riverFrogMoveState = (s: gameState) => (m: FrogMove) => {
      const frog = s.frog.move(m),
        score: number = calculateScoreRiver(frog)(m)(s.distTargetAreas)(
          s.turtles
        )(s.planks)(s.crocs)(updateScore(s.score));
      return <gameState>{
        ...s,
        frog: frog.moveAtRiver(s.turtles)(s.planks)(s.crocs)(s.distTargetAreas),
        score: score,
        highScore: updateHighScore(score)(s.highScore),
        distTargetAreas: updateDistTargetAreaOccupied(frog)(s.distTargetAreas),
      };
    },
    // returns state if Frog is on road and no user move
    // frog stay in its position if no collision else it go default position (dies)
    // moving objs are moved
    roadNoFrogMoveState = (s: gameState) => (id: string) => {
      const f = s.frog.moveCarCollide(s.cars);
      return <gameState>{
        ...s,
        frog: f.noMove(),
        cars: moveNotTurtles(id)(s.cars),
        planks: moveNotTurtles(id)(s.planks),
        crocs: moveNotTurtles(id)(s.crocs),
        turtles: moveTurtles(f.noMove())(id)(s.turtles),
      };
    },
    // returns the river moving object that the Frog is in
    riverMovingObjWithFrog: riverMovingObjWithFrogFunc =
      (frog) => (planks) => (crocs) => (turtles) => {
        return frog.y == 280
          ? turtles.filter((x) => isIdEqual(x.id)(frog.mObjId))[0]
          : frog.y == 130
          ? crocs.filter((x) => isIdEqual(x.id)(frog.mObjId))[0]
          : planks.filter((x) => isIdEqual(x.id)(frog.mObjId))[0];
      },
    // returns state if Frog is on (river or safezone) and no user move
    // frog stay in its position if in safezone
    // frog move along with moving obj if moving obj not hit svg edges
    // else frog go to default position (dies)
    // moving objs are moved
    riverNoFrogMoveState = (s: gameState) => (id: string) => {
      const o: riverMovingObj = riverMovingObjWithFrog(s.frog)(s.planks)(s.crocs)(
        s.turtles
      );
      const f = s.frog.noMoveAtRiver(id)(o);
      return <gameState>{
        ...s,
        frog: f.noMove(),
        cars: moveNotTurtles(id)(s.cars),
        planks: moveNotTurtles(id)(s.planks),
        crocs: moveNotTurtles(id)(s.crocs),
        turtles: moveTurtles(f.noMove())(id)(s.turtles),
      };
    };

  // Observable stream of user keydown events
  const keydown$: Observable<KeyboardEvent> = fromEvent<KeyboardEvent>(
    document,
    "keydown"
  );

  // create Observable of FrogMove based on key
  const makeMovesStream: (
    key: string,
    move: FrogMove
  ) => Observable<FrogMove> = (key, move) =>
    keydown$.pipe(
      filter((e) => e.key == key),
      map((_) => move)
    );

  // "a" keydown event is for Frog to move left
  const moveLeft$: Observable<FrogMove> = makeMovesStream(
      "a",
      new FrogMove("left")
    ),
    // "d" keydown event is for Frog to move right
    moveRight$: Observable<FrogMove> = makeMovesStream(
      "d",
      new FrogMove("right")
    ),
    // "w" keydown event is for Frog to move up
    moveUp$: Observable<FrogMove> = makeMovesStream(
      "w", 
      new FrogMove("up")
    ),
    // "s" keydown event is for Frog to move down
    moveDown$: Observable<FrogMove> = makeMovesStream(
      "s",
      new FrogMove("down")
    );

  // merge the keys allowed to control Frog movement into single Observable
  const moves$: Observable<FrogMove> = merge(
    moveLeft$,
    moveRight$,
    moveUp$,
    moveDown$
  );

  /* 
    create observable of moving object ids that are emited at specified intervals
    make sure that every moving object is updated at specified interval to produce
    moving effect
    concatMap maps a list of moving object ids as observables
  */
  const makeMoveObjsStream: (n: number, ids: string[]) => Observable<string> = (
    n,
    ids
  ) => interval(n).pipe(concatMap((_) => from(ids).pipe()));

  // stream of cars
  const cars1$: Observable<string> = makeMoveObjsStream(
      50,
      ["a", "b", "c"]
        .map((x) => "car1" + x)
        .concat(["a", "b", "c"].map((x) => "car3" + x))
    ),
    // stream of cars
    cars2$: Observable<string> = makeMoveObjsStream(
      30,
      ["a", "b", "c"]
        .map((x) => "car2" + x)
        .concat(["a", "b", "c"].map((x) => "car4" + x))
    ),
    // stream of planks
    planks$: Observable<string> = makeMoveObjsStream(
      50,
      ["a", "b", "c"]
        .map((x) => "plank1" + x)
        .concat(["a", "b", "c"].map((x) => "plank2" + x))
    ),
    // stream of turtles
    turtles$: Observable<string> = makeMoveObjsStream(
      40,
      ["a", "b", "c", "d", "e"].map((x) => "turtle1" + x)
    ),
    // stream of crocodiles
    crocs$: Observable<string> = makeMoveObjsStream(
      30,
      ["a", "b", "c"].map((x) => "croc1" + x)
    );

  // stream of moving objects
  const movingObjs$: Observable<string> = merge(
    cars1$,
    cars2$,
    planks$,
    turtles$,
    crocs$
  );

  /* 
    - merge "start", moves$ & movingObjs$ to make a single stream
    - scan function is used to update the state of game using gameState object
    - reduceState function is called in scan to create a new gameState object
    - updateView is called in subscribe to manipulate HTML based on gameState
    - all impure code is executed via the subscribe function and contained here
    - delayWhen is used to make a delay of 100s when a round is restarted to ensure
    the game restarts smoothly
  */
  const gameStream$: Observable<gameState> = merge(from(["start"]), moves$, movingObjs$)
    .pipe(scan(reduceState, INITIAL_STATE));
  gameStream$.pipe(delayWhen((x) => timer(x.restart ? 100 : 0))).subscribe(updateView);
}

// The following simply runs your main function on window load.  Make sure to leave it in place.

if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}
