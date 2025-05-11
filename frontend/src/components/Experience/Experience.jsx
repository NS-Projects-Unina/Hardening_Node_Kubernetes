import { FiEdit, FiTrash2 } from "react-icons/fi";
import "./Experience.css";
import Dialog from "../Dialog/Dialog";
import { useEffect, useState } from "react";
import client from "../../services/graphql/apolloClient";
import {
  DELETE_EXPERIENCE,
  UPDATE_EXPERIENCE,
} from "../../services/graphql/mutations";
import { enqueueSnackbar } from "notistack";

function Experience({ data, isOwner, categoriesArray, setExpsArray }) {
  const { title, content, createdAt, isPrivate, categories } = data;
  const [openEditExp, setOpenEditExp] = useState(false);
  const [selectedEditCategory, setSelectedEditCategory] = useState(
    categories[0].id
  );
  const [editContent, setEditContent] = useState(content);
  const [editTitle, setEditTitle] = useState(title);
  const [editIsPrivate, setEditIsPrivate] = useState(isPrivate);
  const [openDeleteExp, setOpenDeleteExp] = useState(false);

  useEffect(() => {
    setSelectedEditCategory(categories[0].id);
    setEditContent(content);
    setEditTitle(title);
    setEditIsPrivate(isPrivate);
  }, [openEditExp]);

  const handleEdit = () => {
    setOpenEditExp(true);
  };

  const handleDelete = () => {
    setOpenDeleteExp(true);
  };

  const onClickCancelEdit = () => {
    setOpenEditExp(false);
  };

  const updateExperienceById = (id, updatedData) => {
    setExpsArray((prevExps) =>
      prevExps.map((exp) => (exp.id === id ? { ...exp, ...updatedData } : exp))
    );
  };

  const deleteExperienceById = (id) => {
    setExpsArray((prevExps) => prevExps.filter((exp) => exp.id !== id));
  };

  const onClickSave = async () => {
    const variables = {
      id: data.id,
      title: editTitle,
      content: editContent,
      categoryIds: [selectedEditCategory],
      isPrivate: editIsPrivate,
    };

    try {
      await client.query({
        query: UPDATE_EXPERIENCE,
        variables,
        fetchPolicy: "no-cache",
      });
      updateExperienceById(data.id, variables);
      enqueueSnackbar("Esperienza modificata con successo!", {
        variant: "success",
      });
      setOpenEditExp(false);
    } catch (err) {
      enqueueSnackbar("Si è verificato un errore, riprova.", {
        variant: "error",
      });
    }
  };

  const onClickCancelDelete = () => {
    setOpenDeleteExp(false);
  };

  const onClickDeleteExp = async () => {
    const variables = {
      id: data.id,
    };
    try {
      await client.query({
        query: DELETE_EXPERIENCE,
        variables,
        fetchPolicy: "no-cache",
      });
      deleteExperienceById(data.id);
      enqueueSnackbar("Esperienza eliminata con successo!", {
        variant: "success",
      });
      setOpenDeleteExp(false);
    } catch (err) {
      enqueueSnackbar("Si è verificato un errore, riprova.", {
        variant: "error",
      });
    }
  };

  return (
    <div className="experience-card">
      <Dialog
        title="Modifica Esperienza"
        open={openEditExp}
        setOpen={setOpenEditExp}
      >
        <div className="editexp-dialog-content">
          <div className="filter">
            <select
              id="category"
              name="category"
              value={selectedEditCategory}
              onChange={(e) => {
                setSelectedEditCategory(e.target.value);
              }}
            >
              {categoriesArray.map((cat) => (
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
            value={editTitle}
            onChange={(e) => {
              setEditTitle(e.target.value);
            }}
          />
          <textarea
            id="experience-content"
            name="experienceContent"
            placeholder="Scrivi qui la tua esperienza..."
            rows="6"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="experience-textarea"
          />
          <div className="filter">
            <select
              id="privacy"
              name="privacy"
              value={editIsPrivate}
              onChange={(e) => setEditIsPrivate(e.target.value == "true")}
              className="experience-select"
            >
              <option value="false">Pubblico</option>
              <option value="true">Privato</option>
            </select>
          </div>
          <div className="buttons">
            <button onClick={onClickCancelEdit}>Annulla</button>
            <button onClick={onClickSave}>Salva</button>
          </div>
        </div>
      </Dialog>
      <Dialog
        title="Elimina Esperienza"
        open={openDeleteExp}
        setOpen={setOpenDeleteExp}
      >
        <div className="editexp-dialog-content">
          <div className="delete-description">
            Sei sicuro di voler eliminare questa esperienza?
            <br /> L'operazione è irreversibile.
          </div>
          <div className="buttons">
            <button onClick={onClickCancelDelete}>Annulla</button>
            <button onClick={onClickDeleteExp}>Elimina Esperienza</button>
          </div>
        </div>
      </Dialog>
      <div className="experience-header">
        <h4>{title}</h4>

        {isOwner && (
          <div className="experience-controls">
            <span className="privacy-info">
              Privacy: {isPrivate ? "Privata" : "Pubblica"}
            </span>
            <button onClick={handleEdit} title="Modifica">
              <FiEdit />
            </button>
            <button onClick={handleDelete} title="Elimina">
              <FiTrash2 />
            </button>
          </div>
        )}
      </div>

      <p>{content}</p>

      <div className="experience-meta">
        <small>
          Creato il: {new Date(Number(createdAt)).toLocaleDateString()}
        </small>

        <br />
        <small>Categorie: {categories.map((c) => c.name).join(", ")}</small>
      </div>
    </div>
  );
}

export default Experience;
