import { useEffect, useRef, useState } from "react";
import '../styles/VideoMeet.css'
import { TextField, Button, } from "@mui/material";
import { io } from "socket.io-client";
// import { connection } from "mongoose";




 const server_url = "http://localhost:8080";
 let connections = {};

 const peerConfigConnections = {
    "iceServers":[
        { "urls":"stun:stun.l.google.com:19302"}
    ]
 }

export default function VideoMeet() {

   let socketRef = useRef();
   let socketIdRef = useRef();

   let localVideoRef = useRef();

   let [videoAvailable, setVideoAvailable] = useState(true);
   let [audioAvailable, setAudioAvailable] = useState(true);
   let [video, setVideo] = useState([]);
   let [audio, setAudio] = useState();
   let [screen, setScreen] = useState();
   let [showModel, setShowModel] = useState();
   let [screenAvailable, setScreenAvailable] = useState();
   let [messages, setMessages] = useState([]);
   let [message, setMessage] = useState("");
   let [newMessages, setNewMessages] = useState(0);
   let [askForUsername, setAskForUsername] = useState(true);
   let [username, setUsername] = useState("");
   
   const videoRef = useRef();
   let [videos, setVideos]= useState([])

   // TODO
    // if(isChrome()===false){

    // }

    //! Taking audio and video permissions 
    const getPermissions = async()=>{
        try{
                const videoPermission = await navigator.mediaDevices.getUserMedia({video:true})

                if(videoPermission){
                    setVideoAvailable(true)
                }else{
                    setVideoAvailable(false)
                }

                const audioPermission = await navigator.mediaDevices.getUserMedia({audio:true})

                if(audioPermission){
                    setAudioAvailable(true)
                }else{
                    setAudioAvailable(false)
                }

                if(navigator.mediaDevices.getDisplayMedia){
                    setScreenAvailable(true);

                }else{
                    setScreenAvailable(false)
                }

                if(videoAvailable || audioAvailable){
                    const userMediaStream = await navigator.mediaDevices.getUserMedia({video:videoAvailable, audio:audioAvailable});

                    if(userMediaStream){
                        window.localStream = userMediaStream;
                        if(localVideoRef.current){
                            localVideoRef.current.srcObject = userMediaStream;
                        }
                    }
                }


        }catch(err){
            console.log("Error : ", err.message);

        }
    }

    useEffect(()=>{
        getPermissions();

    }, [])

    let getUserMediaSuccesss = (stream)=>{

    }

   let getUserMedia = () => {
   if ((video && videoAvailable) || (audio && audioAvailable)) {
    navigator.mediaDevices
      .getUserMedia({ video, audio })
      .then((stream) => {
        // you can assign stream to a video element here
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        console.log("Stream started:", stream);
      })
      .catch((err) => {
        console.error("Error:", err.message);
      });
  } else {
    try {
      const tracks = localVideoRef.current?.srcObject?.getTracks();
      if (tracks) {
        tracks.forEach((track) => track.stop());
      }
    } catch (err) {
      console.error("Error:", err.message);
    }
  }
};

    useEffect(()=>{
        if(video != undefined && audio != undefined){
            getUserMedia();
        }

    }, [audio, video])

    let gotMessageFromServer = (fromId, message)=>{

        

    }

    let connectToSocketServer = ()=>{

        socketRef.current = io.connect(server_url, {secure:false});
        socketRef.current.on('signal', gotMessageFromServer)

        socketRef.current.on("connect", ()=>{

            socketRef.current.emit("join-call", window.location.href);
            socketRef.current = socketRef.current.id;
            socketRef.current.on("chat-message", addMessage);

            socketRef.current.on("user-left", (id)=>{
                setVideo((videos)=> videos.filter((video)=>video.socketId != id))
            })

            socketRef.current.on("user-joined", (id, clientes)=>{
                clientes.forEach((socketListId)=>{

                    connections[socketListId] = new RTCPeerConnection(peerConfigConnections);

                    connections[socketListId].oniceandidate = (event)=>{
                        if(event.candidate != null){
                            socketRef.current.emit("signal", socketListId, JSON.stringify({'ice': event.candidate}))
                        }
                    }

                    connections[socketListId].onaddstream = (event)=>{

                        let videoExists = videoRef.current.find(video => video.socketId === socketListId);

                        if(videoExists){
                            setVideo(videos =>{
                                const updatedVideos = video.map(video=>
                                    video.socketId === socketListId ? {...video, stream:event.stream} : video
                                );
                                videoRef.current = updatedVideos;
                                return updatedVideos;
                            })
                        }else{

                            let newVideo = {
                                socketId: socketListId,
                                stream: event.stream,
                                autoPlay:true,
                                playsinline:true
                            }

                            setVideos(videos=>{
                                const updatedVideos = [...videos, newVideo];
                                videoRef.current= updatedVideos;
                                return updatedVideos;
                            })

                        }
                    }

                    if(window.localStream != undefined && window.localStream != null){
                        connections[socketListId].addStream(window.localStream);
                    }else{
                        //todo BlackSilence
                    }

                })

                if(id=== socketIdRef.current){

                    for(let id2 in connections){
                        if(id2 === socketIdRef.current) continue

                        try{
                            connections[id2].addStream(window.localStream)

                        }catch(err){ console.log(err);}

                        connections[id2].createOffer().then((description)=>{
                            connections[id2].setLocalDescription(description)
                            .then(()=>{
                                socketRef.current.emit("signal", id2, JSON.stringify({"sdp": connections[id2].localDescription}))
                            })
                            .catch(e=> console.log(e))
                        })
                    }
                }

            })
        })

         
    }



    let getMedia = ()=>{

        setVideo(videoAvailable);
        setAudio(audioAvailable);
        connectToSocketServer();
    }
    let connect = ()=>{
        setAskForUsername(false);
        getMedia();
    }
  return (
    <div>
        {askForUsername === true?
            <div>
                 <h2>Enter to Lobby</h2>
                 {/* <input type="text" className="form-control" placeholder="Username" value={username}  onChange={e=> setUsername(e.target.value)}/> */}
                 <TextField id="outlined-basic" label="Username" value={username} onChange={e=>setUsername(e.target.value)} />
                 <Button variant="contained" onClick={connect}>Connect</Button>

                 <div>
                    <video ref={localVideoRef} autoPlay muted></video>
                 </div>
   
            </div> :<></>
        }
    </div>
  )
}
