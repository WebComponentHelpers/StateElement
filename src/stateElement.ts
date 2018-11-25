import onChangeProxy from "./onChage.js"


var _isCallback_locked = false;
const _transitions_callbackMap :  Map<StateVariable, Function> = new Map();
// _transitions_callbackMap.clear();  // is this needed??  FIXME

export class StateChange {
    name : string;
    callbackMap : Map<EventTarget,Function> ;
    usrDefined_transition: Function;

    constructor(NAME:string){
        this.name = NAME;
        this.callbackMap = new Map();
        this.usrDefined_transition = undefined;

        if(typeof(this.name) !== "string") throw Error("Variable name must be a string.");
    }

    lock_callbacks(){
        if(_isCallback_locked) {
            this.unlock_callbacks();
            throw Error('Forbidden multiple-update during an update callback loop.');
        } 
        else  _isCallback_locked = true;
    }

    unlock_callbacks(){
        _isCallback_locked = false;
    }

    updateWatchers( input?:any ) :void {

        this.lock_callbacks();

        this.usrDefined_transition(input);

        // loop over watchers callbacks
        this._call_watchers(input);

        // loop over automatically added callbacks to _transitions_callbackMap
        for (let upd_callback of _transitions_callbackMap.values()){
            upd_callback();
        }

        _transitions_callbackMap.clear();
        this.unlock_callbacks();
    }

    _call_watchers(input?:any){
        for( let update_callback of this.callbackMap.values()){
            if(input === undefined) update_callback(); 
            else update_callback(input);
        }
    }

    attachWatcher( target:HTMLElement, callback:Function ) :void {
        if(target === null || target === undefined )
            throw Error("Target is undefined.")
        // add element to the watcher list
        this.callbackMap.set(target, callback);
    }

    detachWatcher( target:HTMLElement) :void {
        if(target === null || target === undefined )
            throw Error("Target is undefined.")
        // remove element from watcher list
        this.callbackMap.delete(target);
    }

}

export class StateVariable extends StateChange{
    type : string;
    default_val : any ;
    _err_on_value :string;
    _val : any;
    _valueProxy: ProxyConstructor;

    constructor(NAME:string, DEFAULT:any){   // FIXME DEFAULT HAS A TYPE OF TYPE
        super(NAME);
        this.type = typeof(DEFAULT);
        this.default_val = DEFAULT;
        this._err_on_value = 'Wrong type assignment to state variable: ' + this.name;
        this._valueProxy = undefined;

        // Sanity checks
        let white_list_types = ["string", "object", "number", "boolean"];
        if(!white_list_types.includes(this.type)) throw TypeError(this._err_on_value);

        // set default variable if none
        this._val = this.GET() || this.CREATE(this.default_val); 

        // proxy
        if(this.type === "object")
            this._valueProxy = onChangeProxy( this._val, this.UPDATE_DATA.bind(this) );
    }

    set value(val: any) {
        this._val = val;
        if (this.type === "object" && typeof(val) === "object")
            this._valueProxy = onChangeProxy(this._val, this.UPDATE_DATA.bind(this));
        this.UPDATE_DATA();
    }
    get value(): any {
        return (this.type === "object") ? this._valueProxy : this._val;
    }

    CREATE(me:any):any{
        if( typeof(me) === this.type ) {
            let push_var = (this.type !== 'string') ? JSON.stringify(me) : me;
            localStorage.setItem(this.name, push_var);
        }
        else throw TypeError(this._err_on_value);   
        return me;
    }

    UPDATE_DATA():void{
        if( typeof(this._val) === this.type ) {
            let push_var = (this.type !== 'string') ? JSON.stringify(this._val) : this._val;
            localStorage.setItem(this.name, push_var);
        }
        else throw TypeError(this._err_on_value);   
    }

    RESET():void{
        this.value = this.default_val ;
    }

    GET():any{
        let return_val = localStorage.getItem(this.name);
        if(return_val === null)  return return_val;
        if(this.type !== 'string'){
            return_val = JSON.parse(return_val);
            if(typeof(return_val) !== this.type ) 
                throw TypeError("State variable: "+this.name+" is corrupted, returns type "+typeof(return_val) +" expecting "+ this.type);
        }
        return return_val;
    }

    get auto_value(){
        this._markForWatchersUpdate();
        return this.value;
    }

    set auto_value(val){
        this._markForWatchersUpdate();
        this.value = val;
    }
    _markForWatchersUpdate(){
        _transitions_callbackMap.set(this, this._call_watchers.bind(this));
    }

    updateWatchers() :void {

        this.lock_callbacks();
               
        this.UPDATE_DATA();
    
        // loop over watchers callbacks
        this._call_watchers();

        this.unlock_callbacks();
    }
    

}

export class Message extends StateChange{
    updateWatchers(input:any) :void {
        this._call_watchers(input);
    }
}


// mixin to be applied to a web-component
// FIXME: 
//  - make test machinery
/*
export let statesMixin = (baseClass:any, listOfStates:Array<string>) => class extends baseClass {

    constructor(){
        super();
        this._addGetterSetters();
    }

    _addGetterSetters():void{
        for( let state of listOfStates){
            
            //console.log('adding getter and setters for: ', state);

            Object.defineProperty(this, state, {
                set: (val) => { 
                    //console.log('dispatching UPDATE-'+state+' with value: ', val);
                    let event = new CustomEvent('UPDATE-'+state, { bubbles:true, detail:{'value':val} }); 
                    this.dispatchEvent(event);
                },
                get: () => { return JSON.parse(localStorage.getItem(state)); }
            });    
        }
    }
        
    connectedCallback(){
        //console.log('Im connected, running connected callback');
        if(super['connectedCallback'] !== undefined) {
            super.connectedCallback();
        }
        // watch default state variables
        for (let state of listOfStates) {
            let update = this['on_update_'+state].bind(this);
            let event = new CustomEvent('WATCH-'+state, { bubbles:true, detail:{'update':update} });
            //console.log('----> dispatching event: ', 'WATCH-'+state);
            this.dispatchEvent(event);
        }
    }
    
}*/