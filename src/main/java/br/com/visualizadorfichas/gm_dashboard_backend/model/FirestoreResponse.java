package br.com.visualizadorfichas.gm_dashboard_backend.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.Objects;

@JsonIgnoreProperties(ignoreUnknown = true)
public class FirestoreResponse {

    private CharacterFields fields;

    // Construtor vazio (necessário para o Jackson)
    public FirestoreResponse() {
    }

    // Getter
    public CharacterFields getFields() {
        return fields;
    }

    // Setter
    public void setFields(CharacterFields fields) {
        this.fields = fields;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        FirestoreResponse that = (FirestoreResponse) o;
        return Objects.equals(fields, that.fields);
    }

    @Override
    public int hashCode() {
        return Objects.hash(fields);
    }
}