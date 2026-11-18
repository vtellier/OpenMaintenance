package handlers

import (
	"database/sql"
	"errors"
	"strings"

	"github.com/labstack/echo/v4"
	dbpackage "github.com/vtellier/OpenMaintenance/internal/db"
	"github.com/vtellier/OpenMaintenance/internal/models"
)

const (
	errGroupNameTaken = "A group with this name already exists"
	errGroupNotFound  = "Group not found"
)

func (h *Handler) ListGroups(ctx echo.Context) error {
	groups, err := dbpackage.ListGroups(h.DB)
	if err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}
	return ctx.JSON(200, groups)
}

func (h *Handler) CreateGroup(ctx echo.Context) error {
	input := new(models.Group)
	if err := ctx.Bind(input); err != nil {
		return ctx.JSON(400, map[string]string{"error": err.Error()})
	}
	group := &models.Group{Name: strings.TrimSpace(input.Name), Icon: input.Icon}
	if status, msg := h.checkGroupName(group.Name, 0); status != 0 {
		return ctx.JSON(status, map[string]string{"error": msg})
	}
	if err := dbpackage.CreateGroup(h.DB, group); err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}
	return ctx.JSON(201, group)
}

func (h *Handler) UpdateGroup(ctx echo.Context, id int) error {
	input := new(models.Group)
	if err := ctx.Bind(input); err != nil {
		return ctx.JSON(400, map[string]string{"error": err.Error()})
	}
	group, err := dbpackage.GetGroup(h.DB, id)
	if errors.Is(err, sql.ErrNoRows) {
		return ctx.JSON(404, map[string]string{"error": errGroupNotFound})
	} else if err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}
	group.Name = strings.TrimSpace(input.Name)
	group.Icon = input.Icon
	if status, msg := h.checkGroupName(group.Name, id); status != 0 {
		return ctx.JSON(status, map[string]string{"error": msg})
	}
	if err := dbpackage.UpdateGroup(h.DB, group); err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}
	return ctx.JSON(200, group)
}

// DeleteGroup deletes a group and ungroups its equipments; it never deletes
// an equipment.
func (h *Handler) DeleteGroup(ctx echo.Context, id int) error {
	if err := dbpackage.DeleteGroup(h.DB, id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ctx.JSON(404, map[string]string{"error": errGroupNotFound})
		}
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}
	return ctx.NoContent(204)
}

// checkGroupName enforces the group name rules (doc/data-model.md, "Group"):
// not empty, and unique ignoring case among the groups other than exceptID.
// It returns the HTTP status and reason of a refusal, or 0 when the name is
// allowed.
func (h *Handler) checkGroupName(name string, exceptID int) (int, string) {
	if name == "" {
		return 400, "Name is required"
	}
	groups, err := dbpackage.ListGroups(h.DB)
	if err != nil {
		return 500, err.Error()
	}
	for _, g := range groups {
		if g.ID != exceptID && strings.EqualFold(g.Name, name) {
			return 409, errGroupNameTaken
		}
	}
	return 0, ""
}
