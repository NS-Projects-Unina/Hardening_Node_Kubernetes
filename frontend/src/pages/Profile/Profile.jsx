import "./Profile.css";
import { FiPlus } from "react-icons/fi";
import { useSelector } from "react-redux";
import Experiences from "../../components/Experiences/Experiences";
import Dialog from "../../components/Dialog/Dialog";
import { useEffect, useState } from "react";
import { CREATE_EXPERIENCE } from "../../services/graphql/mutations";
import { enqueueSnackbar } from "notistack";
import client from "../../services/graphql/apolloClient";

function Profile() {
  const { user } = useSelector((state) => state.auth);
  const [openCreateExp, setOpenCreateExp] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(
    "5956cda7-09f0-437c-915b-c853d9f39fed"
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  useEffect(() => {
    setSelectedCategory("5956cda7-09f0-437c-915b-c853d9f39fed");
    setTitle("");
    setContent("");
    setIsPrivate(false);
  }, []);

  const categories = [
    { id: "5956cda7-09f0-437c-915b-c853d9f39fed", name: "Viaggi e Avventure" },
    { id: "b6c4fb32-3fb9-4b8c-a03d-37b0210f737d", name: "Crescita Personale" },
    { id: "7908505a-bcdc-4246-8209-74fa6a345bc1", name: "Relazioni" },
    { id: "c6a028a3-2ec2-46f6-86eb-ce80cd7f3f3f", name: "Lavoro e Carriera" },
    { id: "c9c86e8b-60b3-43dc-955e-849481777e7e", name: "Salute e Benessere" },
    { id: "cc93e49b-0092-48ef-b73a-393bed37de46", name: "Istruzione e Studio" },
    { id: "2310d56e-6ab5-42c8-941e-f8866a77bc9e", name: "Tecnologia" },
    { id: "a8bbba06-7b68-4005-a887-e141212bd0dc", name: "Spiritualità" },
    { id: "6755d975-a24e-43df-8f1a-e4c39da7e1b0", name: "Arte e Creatività" },
    {
      id: "c17e5d9c-4607-473b-9dab-b4a828727f87",
      name: "Volontariato e Impatto Sociale",
    },
  ];

  const onClickCreate = async () => {
    if (!title || !content) {
      enqueueSnackbar("Verifica che tutti i campi siano compilati.", {
        variant: "error",
      });
      return;
    }
    const variables = {
      categoryIds: [selectedCategory],
      content,
      title,
      isPrivate,
    };
    try {
      await client.query({
        query: CREATE_EXPERIENCE,
        variables,
        fetchPolicy: "no-cache",
      });
      enqueueSnackbar("Esperienza creata con successo!", {
        variant: "success",
      });
      setOpenCreateExp(false);
    } catch (err) {
      enqueueSnackbar("Si è verificato un errore, riprova.", {
        variant: "error",
      });
    }
  };

  const onClickCloseCreate = () => {
    setOpenCreateExp(false);
  };

  return (
    <div className="profile-container">
      <div className="profile-header">
        <div>
          <h2>{user.username}</h2>

          <p className="profile-bio">{user.bio}</p>
        </div>
      </div>

      <Dialog
        title="Crea Esperienza"
        open={openCreateExp}
        setOpen={setOpenCreateExp}
      >
        <div className="create-dialog-content">
          <div className="filter">
            <select
              id="category"
              name="category"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
              }}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <input
            type="text"
            id="experience-title"
            name="experienceTitle"
            placeholder="Inserisci il titolo..."
            className="experience-input"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
            }}
          />
          <textarea
            id="experience-content"
            name="experienceContent"
            placeholder="Scrivi qui la tua esperienza..."
            rows="6"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="experience-textarea"
          />
          <div className="filter">
            <select
              id="privacy"
              name="privacy"
              value={isPrivate}
              onChange={(e) => setIsPrivate(e.target.value == "true")}
              className="experience-select"
            >
              <option value="false">Pubblico</option>
              <option value="true">Privato</option>
            </select>
          </div>
          <div className="buttons">
            <button onClick={onClickCloseCreate}>Annulla</button>
            <button onClick={onClickCreate}>Crea</button>
          </div>
        </div>
      </Dialog>

      <div className="profile-actions">
        <button
          className="create-button"
          onClick={() => setOpenCreateExp(true)}
          title="Crea nuova esperienza"
        >
          <FiPlus /> <span>Crea Esperienza</span>
        </button>
      </div>

      <div className="profile-experiences">
        <h3>Esperienze</h3>
        <Experiences mine={true} />
      </div>
    </div>
  );
}

export default Profile;
