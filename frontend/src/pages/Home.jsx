import { useContext, useState, useEffect } from "react";
import WithAuth from "../utils/WithAuth";
import { useNavigate } from "react-router-dom";
import {
  Button,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import { Restore } from "@mui/icons-material";
import { toast } from "react-toastify";
import "../styles/Home.css";
import { AuthContext } from "../contexts/AuthContext";

function Home() {
  const [meetingCode, setMeetingCode] = useState("");
  const [meetings, setMeetings] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const navigate = useNavigate();
  const { addToUserHistory, getHistoryOfUser } = useContext(AuthContext);

  useEffect(() => {
    // Load meeting history when component mounts
    const loadHistory = async () => {
      try {
        const history = await getHistoryOfUser();
        setMeetings(history);
      } catch (err) {
        console.error("Failed to load history:", err);
      }
    };
    loadHistory();
  }, [getHistoryOfUser]);

  const handleJoinVideoCall = async () => {
    if (!meetingCode.trim()) {
      toast.error("Please enter a meeting code");
      return;
    }
    try {
      await addToUserHistory(meetingCode);
      navigate(`/${meetingCode}`);
    } catch (err) {
      console.error("Failed to join meeting:", err);
    }
  };

  return (
    <>
      <div className="navBar">
        <div className="logoContainer">
          <h2>Vyntra</h2>
        </div>
        <div className="navOptions">
          <IconButton onClick={() => setShowHistory(true)}>
            <Restore />
          </IconButton>
          <p>History</p>
          <Button
            onClick={() => {
              localStorage.removeItem("token");
              navigate("/auth");
            }}
          >
            LogOut
          </Button>
        </div>

        {/* Meeting History Dialog */}
        <Dialog
          open={showHistory}
          onClose={() => setShowHistory(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Meeting History</DialogTitle>
          <DialogContent>
            {meetings.length === 0 ? (
              <p>No previous meetings found.</p>
            ) : (
              <List>
                {meetings.map((meeting, index) => (
                  <ListItem
                    key={meeting._id}
                    button
                    onClick={() => {
                      setShowHistory(false);
                      navigate(`/${meeting.meetingCode}`);
                    }}
                  >
                    <ListItemText
                      primary={`Meeting: ${meeting.meetingCode}`}
                      secondary={new Date(meeting.date).toLocaleString()}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="meetContainer">
        <div className="leftPanel">
          <div>
            <hp>Providing Quality Video Call Just Like Quality Education</hp>

            <div className="meeting-input-container">
              <TextField
                variant="outlined"
                label="Enter Meeting Code"
                placeholder="Enter code to join meeting"
                onChange={(e) => setMeetingCode(e.target.value)}
                value={meetingCode}
                fullWidth
                className="meeting-input"
              />
              <Button
                onClick={handleJoinVideoCall}
                variant="contained"
                size="large"
                className="join-button"
              >
                Join
              </Button>
            </div>
          </div>
        </div>
        <div className="rightPanel">
          <img src="/logo3.png" alt="" />
        </div>
      </div>
    </>
  );
}

const ProtectedHome = WithAuth(Home);
export default ProtectedHome;
